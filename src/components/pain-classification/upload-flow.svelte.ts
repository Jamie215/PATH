/**
 * The "upload completed tests" flow on the professional collection page.
 *
 * A packet can be the on-screen "all tests" PDF (answers already structured),
 * a scanned multi-page PDF, or photos (one per sheet). Scans are OMR-read and
 * routed to assessments; the reviewer confirms the page→test mapping, is warned
 * before existing results are replaced, and then confirms each test in turn in
 * its own survey. Nothing is written to storage until a step is confirmed —
 * the embedded survey persists it, and `host.onConfirmed` folds it into the
 * card.
 *
 * Rune-based (`.svelte.ts`) so the dialogs can read the state reactively. The
 * heavy readers (pdf-lib, pdf.js, the OMR router) are imported lazily on the
 * first upload.
 */
import { grayImageToDataURL } from '../../lib/omr/decode-image';
import { cropBand } from '../../lib/omr/image';
import type { PageRoute } from '../../lib/omr/route';
import type { CombinedChildRead } from '../../lib/omr/pdf-form-reader';
import type { GrayImage, OmrReadResult } from '../../lib/omr/types';
import { sanitizeBothersomeArea } from '../../assessments/frebaq/area';
import { get as storeGet, set as storeSet } from '../../lib/storage';
import {
  ACUTE_CHILDREN,
  KEYS,
  type ChildAssessment,
} from '../../assessments/pain-classification/config';

/** What the flow needs from the collection page. */
export interface UploadFlowHost {
  /** Current card values, used to pre-fill a review when the sheet has none. */
  area(slug: string): string | undefined;
  comment(slug: string): string | undefined;
  /** The child already has a result (so an upload would replace it). */
  isComplete(child: ChildAssessment): boolean;
  /** A review step was confirmed; its survey has already persisted the result. */
  onConfirmed(child: ChildAssessment): void;
}

/** A handwriting region cropped from a scan. */
export interface ReviewCrop {
  key: string;
  label: string;
  kind: 'line' | 'box';
  dataUrl: string;
  image: GrayImage;
  hasInk: boolean;
}

/** The uploaded sheet currently awaiting the reviewer's confirmation. */
export interface Review {
  child: ChildAssessment;
  /** The flattened scan to check answers against (scan channel); null for a
   *  filled PDF, which is shown side-by-side via `pdfUrl` instead. */
  imageUrl: string | null;
  /** Object URL of the uploaded PDF, shown next to the form. */
  pdfUrl?: string;
  /** Zero-based page of the PDF this test sits on. */
  pdfPage?: number;
  response: Record<string, number>;
  /** Pre-filled bothersome area (FreBAQ), from the sheet, OCR, or the card. */
  area?: string;
  /** Zoomed crop of the scanned area handwriting, pinned next to the field. */
  areaCropUrl?: string;
  /** `cleaned` = correction marks were removed before reading (verify);
   *  `unread` = marks dominated, so nothing was auto-read. */
  areaCorrection?: 'cleaned' | 'unread';
  /** Pre-filled comments, from the sheet or the card. */
  comments?: string;
  /** Handwriting crops shown while OCR runs (scan only). */
  crops?: ReviewCrop[];
  /** Handwriting recognition is still running on the crops. */
  ocrBusy?: boolean;
  /** The area region carried content, so the reviewer must confirm it. */
  requireArea?: boolean;
  /** The comments region carried content; highlighted only. */
  commentsDetected?: boolean;
  /** Scan only: the read resolved no answers at all — usually the wrong form
   *  or an unreadable sheet. */
  emptyScan?: boolean;
  /** Tests still to confirm after this one. */
  queueRemaining: number;
  attention: string[];
}

/** One scanned page awaiting the reviewer's page→test mapping. */
export interface ScanPage {
  index: number;
  route: PageRoute;
  /** Title-band crop — names the assessment. */
  thumb: string;
  /** Taller crop through the Name/ID + Date line — shown when two pages
   *  claim the same assessment so they can be told apart. */
  thumbWide: string;
  /** Best-fit template id, or '' when nothing matched confidently. */
  suggestedId: string;
}

type QueuedReview =
  | {
      kind: 'pdf';
      child: ChildAssessment;
      response: Record<string, number>;
      area?: string;
      comments?: string;
      page: number;
      attention: string[];
    }
  | { kind: 'scan'; child: ChildAssessment; result: OmrReadResult };

const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

const childTemplates = () =>
  ACUTE_CHILDREN.map((c) => c.omrTemplate).filter((t): t is NonNullable<typeof t> => !!t);

export class UploadFlow {
  /** The drag-and-drop upload dialog is open. */
  uploadOpen = $state(false);
  busy = $state(false);
  error = $state<string | null>(null);
  /** Scanned pages awaiting mapping; non-empty while the mapping dialog is open. */
  scanPages = $state<ScanPage[]>([]);
  /** Assessments an upload would replace; non-empty while the warning is open. */
  overwriteList = $state<ChildAssessment[]>([]);
  review = $state<Review | null>(null);
  /** Tests in the current upload, for "Test 2 of 3". */
  total = $state(0);

  #host: UploadFlowHost;
  #queue: QueuedReview[] = [];
  /** Object URL of an uploaded PDF, shared by every step; revoked at the end. */
  #pdfUrl: string | null = null;
  /** Identifies the open review, so async OCR for one can't write into the next. */
  #seq = 0;

  constructor(host: UploadFlowHost) {
    this.#host = host;
  }

  // --- Upload dialog ---------------------------------------------------------

  openUpload = (): void => {
    this.error = null;
    this.uploadOpen = true;
  };

  closeUpload = (): void => {
    if (this.busy) return;
    this.uploadOpen = false;
    this.error = null;
  };

  /** Read an uploaded packet and move on to mapping (scans) or review (PDF). */
  ingest = async (files: File[]): Promise<void> => {
    if (!files.length || this.busy) return;
    this.error = null;
    this.busy = true;
    try {
      const templates = childTemplates();
      const pdfs = files.filter(isPdfFile);
      const images = files.filter((f) => !isPdfFile(f));

      // Fast path: a single fillable PDF is the on-screen "all tests" document —
      // read its structured answers directly, no rasterizing or routing.
      if (files.length === 1 && pdfs.length === 1) {
        const { readCombinedPdfFormFromBlob } = await import('../../lib/omr/pdf-form-reader');
        const digital = await readCombinedPdfFormFromBlob(pdfs[0], templates);
        if (digital.ok) {
          this.#startDigitalQueue(digital.children, pdfs[0]);
          return;
        }
        // Not a fillable form (or filled on paper): try it as a scan below.
      }

      // Scan path: one grayscale image per sheet, from photos and rasterized PDFs.
      const { blobToGrayImage } = await import('../../lib/omr/decode-image');
      const pageImages: GrayImage[] = [];
      for (const img of images) pageImages.push(await blobToGrayImage(img));
      if (pdfs.length) {
        const { rasterizePdfToGray } = await import('../../lib/omr/pdf-raster');
        for (const pdf of pdfs) pageImages.push(...(await rasterizePdfToGray(pdf)));
      }
      if (!pageImages.length) {
        this.error = 'No pages to read from that upload.';
        return;
      }

      // Route each page against every template; the reviewer confirms next. The
      // thumbnails come from any candidate's flattened sheet (they share
      // fiducials) and are encoded once here.
      const { routePage } = await import('../../lib/omr/route');
      const routed: ScanPage[] = pageImages.map((img, index) => {
        const route = routePage(img, templates);
        const flattened = route.candidates[0]?.result.warped ?? img;
        return {
          index,
          route,
          thumb: grayImageToDataURL(cropBand(flattened, 0.03, 0.14)),
          thumbWide: grayImageToDataURL(cropBand(flattened, 0.03, 0.33)),
          suggestedId: route.best?.template.id ?? '',
        };
      });

      // A single PDF that rasterized but matched nothing is almost certainly a
      // results report, not answer sheets.
      if (routed.every((r) => !r.route.best) && pdfs.length === 1 && !images.length) {
        this.error =
          "We couldn't find any answer sheets in that PDF. Upload the completed " +
          'tests — the on-screen "all tests" form, or photos/scans of the printed sheets.';
        return;
      }

      this.scanPages = routed;
      this.uploadOpen = false;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not read the upload.';
    } finally {
      this.busy = false;
    }
  };

  /** Queue a filled combined PDF's per-assessment reads, in card order. */
  #startDigitalQueue(children: CombinedChildRead[], file: File): void {
    const queue: QueuedReview[] = [];
    let capturedName = '';
    for (const c of ACUTE_CHILDREN) {
      const match = children.find((r) => r.templateId === c.omrTemplate?.id);
      if (!match) continue;
      const text = match.result.text ?? {};
      const area =
        typeof text.bothersome_area === 'string' ? sanitizeBothersomeArea(text.bothersome_area) : '';
      const comments = typeof text.other_comments === 'string' ? text.other_comments : '';
      if (!capturedName && typeof text.patient_name === 'string' && text.patient_name.trim()) {
        capturedName = text.patient_name.trim();
      }
      queue.push({
        kind: 'pdf',
        child: c,
        response: match.result.response,
        area: area || undefined,
        comments: comments || undefined,
        page: match.page,
        attention: match.result.attention,
      });
    }

    if (queue.length === 0) {
      this.error =
        "We couldn't match this PDF to any of the assessments. Upload the " +
        'completed-tests PDF you downloaded here.';
      return;
    }
    if (capturedName && !storeGet<string>(KEYS.patientName)) {
      storeSet(KEYS.patientName, capturedName);
    }

    this.#pdfUrl = URL.createObjectURL(file);
    this.uploadOpen = false;
    this.#begin(queue);
  }

  // --- Page mapping ----------------------------------------------------------

  /** Start reviewing the pages mapped to a test (`choices[i]` is page i's
   *  template id, or '' to skip it). */
  confirmMapping = (choices: string[]): void => {
    const queue: QueuedReview[] = [];
    this.scanPages.forEach((p, i) => {
      const id = choices[i];
      if (!id) return;
      const child = ACUTE_CHILDREN.find((c) => c.omrTemplate?.id === id);
      const candidate = p.route.candidates.find((c) => c.template.id === id);
      if (child && candidate) queue.push({ kind: 'scan', child, result: candidate.result });
    });
    this.scanPages = [];
    if (queue.length) this.#begin(queue);
  };

  closeMapping = (): void => {
    this.scanPages = [];
  };

  // --- Overwrite warning -----------------------------------------------------

  /** Start the queue — but first, if it would replace results the user already
   *  recorded, list those for confirmation. */
  #begin(queue: QueuedReview[]): void {
    this.#queue = queue;
    this.total = queue.length;
    const clashes = queue.map((q) => q.child).filter((c) => this.#host.isComplete(c));
    if (clashes.length) this.overwriteList = clashes;
    else this.#next();
  }

  confirmOverwrite = (): void => {
    this.overwriteList = [];
    this.#next();
  };

  /** Abandon the upload, leaving every existing result as it was. */
  cancelOverwrite = (): void => {
    this.overwriteList = [];
    this.#end();
  };

  // --- Review queue ----------------------------------------------------------

  /** The reviewer confirmed a step in its survey (already persisted). */
  confirmReview = (child: ChildAssessment): void => {
    this.#host.onConfirmed(child);
    this.#next();
  };

  /** Closing a review abandons the rest of the upload. */
  closeReview = (): void => {
    this.#end();
  };

  /** Stop waiting on handwriting recognition and confirm manually. */
  skipOcr = (): void => {
    if (this.review) this.review = { ...this.review, ocrBusy: false };
  };

  #next(): void {
    const next = this.#queue.shift();
    if (!next) {
      this.#end();
      return;
    }
    this.#seq += 1;
    if (next.kind === 'scan') this.#presentScan(next.child, next.result);
    else this.#presentPdf(next);
  }

  #end(): void {
    this.#queue = [];
    this.total = 0;
    this.#seq += 1;
    this.review = null;
    if (this.#pdfUrl) {
      URL.revokeObjectURL(this.#pdfUrl);
      this.#pdfUrl = null;
    }
  }

  /** A filled-PDF step: the sheet's typed text pre-fills the survey (which
   *  persists it on confirm) beside the PDF opened to this test's page. */
  #presentPdf(q: Extract<QueuedReview, { kind: 'pdf' }>): void {
    const slug = q.child.slug;
    this.review = {
      child: q.child,
      imageUrl: null,
      pdfUrl: this.#pdfUrl ?? undefined,
      pdfPage: q.page,
      response: q.response,
      area: q.area || this.#host.area(slug),
      comments: q.comments ?? this.#host.comment(slug),
      requireArea: !!q.area,
      commentsDetected: !!q.comments,
      queueRemaining: this.#queue.length,
      attention: q.attention,
    };
  }

  /** A scanned step: build the handwriting crops, start OCR of the area line,
   *  and show the flattened scan beside the survey. */
  #presentScan(child: ChildAssessment, result: OmrReadResult): void {
    const crops: ReviewCrop[] = (result.textCrops ?? []).map((c) => ({
      key: c.key,
      label: c.label,
      kind: c.kind,
      dataUrl: grayImageToDataURL(c.image),
      image: c.image,
      hasInk: c.hasInk,
    }));
    // Only recognize short single-line fields (the bothersome area) that carry
    // ink. Comment boxes are slow and low-value to OCR; the reviewer types them.
    const ocrCrops = crops.filter((c) => c.kind === 'line' && c.hasInk);
    const inked = (key: string) => crops.find((c) => c.key === key && c.hasInk);
    this.review = {
      child,
      imageUrl: result.warped ? grayImageToDataURL(result.warped) : null,
      response: result.response,
      area: this.#host.area(child.slug),
      // Pinned beside the field: the safety net when OCR of a scribbled
      // correction is unreliable.
      areaCropUrl: inked('bothersome_area')?.dataUrl,
      comments: this.#host.comment(child.slug),
      crops: ocrCrops.length ? ocrCrops : undefined,
      ocrBusy: ocrCrops.length > 0,
      requireArea: !!inked('bothersome_area'),
      commentsDetected: !!inked('other_comments'),
      // A scan that registered but resolved nothing is the tell for a wrong
      // form or an unreadable sheet — a photo can't be identity-checked.
      emptyScan: Object.keys(result.response).length === 0,
      queueRemaining: this.#queue.length,
      attention: result.attention,
    };
    if (ocrCrops.length) void this.#runOcr(ocrCrops, this.#seq);
  }

  /** Recognize each crop and pre-fill its field. Best-effort: anything
   *  unrecognized stays blank for manual entry. */
  async #runOcr(crops: ReviewCrop[], seq: number): Promise<void> {
    const { recognizeHandwriting } = await import('../../lib/omr/handwriting');
    for (const c of crops) {
      const { text, corrected, dominated } = await recognizeHandwriting(c.image);
      // The review may have been skipped, confirmed or closed meanwhile.
      if (seq !== this.#seq || !this.review) return;
      if (c.key === 'bothersome_area') {
        // Faithful transcription of the correction-cleaned crop. When correction
        // marks dominate, leave it empty so the reviewer reads the pinned crop
        // rather than confirming a guess.
        this.review = {
          ...this.review,
          area: dominated ? '' : sanitizeBothersomeArea(text),
          areaCorrection: dominated ? 'unread' : corrected ? 'cleaned' : undefined,
        };
      }
    }
    if (seq === this.#seq && this.review) this.review = { ...this.review, ocrBusy: false };
  }
}
