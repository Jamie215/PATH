<script lang="ts">
  /**
   * Acute pain-classification collection page.
   *
   * One card per child assessment, laid out in three columns: the assessment
   * name, inline manual-entry inputs, and a "Fill Out Questionnaire" button
   * that opens the child's survey in a modal. Each card also has an optional
   * comment box; completing the questionnaire carries its comment over here.
   *
   * A child is "complete" once all its numeric fields hold finite values,
   * whether typed directly or populated by a finished questionnaire.
   * "Calculate Results" unlocks once every child is complete.
   *
   * Guards: if no role is stored, redirects back to the intake.
   */
  import { onMount } from 'svelte';
  import { get as storeGet, set as storeSet, remove as storeRemove } from '../lib/storage';
  import MSISurvey from './MSISurvey.svelte';
  import BriefSLANSSSurvey from './BriefSLANSSSurvey.svelte';
  import FreBAQSurvey from './FreBAQSurvey.svelte';
  import PHQ4Survey from './PHQ4Survey.svelte';
  import { readSheetFromBlob, grayImageToDataURL } from '../lib/omr/decode-image';
  import { readPdfFormFromBlob, readCombinedPdfFormFromBlob } from '../lib/omr/pdf-form-reader';
  import { sanitizeBothersomeArea } from '../assessments/frebaq/area';
  import type { GrayImage } from '../lib/omr/types';
  import OmrSheetButton from './OmrSheetButton.svelte';
  import PatientAssessmentFlow from './PatientAssessmentFlow.svelte';
  import {
    ACUTE_CHILDREN,
    KEYS,
    type Role,
    type ChildAssessment,
  } from '../assessments/pain-classification/config';

  let loaded = $state(false);
  let role = $state<Role | null>(null);

  // Per-child working state: numeric field values + an optional comment.
  let values = $state<Record<string, Record<string, number | undefined>>>({});
  let comments = $state<Record<string, string>>({});
  // Free-text bothersome body region (FreBAQ only), surfaced on the card.
  let areas = $state<Record<string, string>>({});
  // The child whose questionnaire is currently open in the modal, if any.
  let modalChild = $state<ChildAssessment | null>(null);
  // Completion fraction (0–1) of the open questionnaire, bound from the
  // embedded survey so the modal header can render a fixed progress bar.
  let modalProgress = $state(0);

  // OMR upload state.
  // The child whose upload modal (drag-and-drop / browse) is open, if any.
  let uploadChild = $state<ChildAssessment | null>(null);
  // True while a file is being dragged over the dropzone.
  let dragActive = $state(false);
  // Slug currently being read, so its dropzone can show a busy label.
  let omrBusy = $state<string | null>(null);
  let omrError = $state<string | null>(null);
  // The scanned sheet awaiting the user's confirmation.
  let omrReview = $state<{
    child: ChildAssessment;
    /** The flattened scan to check answers against (scan channel); null for a
     *  filled PDF, which is shown side-by-side via `pdfUrl` instead. */
    imageUrl: string | null;
    /** Object URL of the uploaded PDF, rendered next to the form so a filled
     *  PDF gets the same side-by-side review as a scan. Revoked on close. */
    pdfUrl?: string;
    response: Record<string, number>;
    /** Pre-filled bothersome area (FreBAQ), from a filled PDF, OCR, or prior entry. */
    area?: string;
    /** Zoomed crop of the scanned bothersome-area handwriting (scan only),
     *  pinned next to the field in review so it can be transcribed/verified. */
    areaCropUrl?: string;
    /** Correction-mark outcome for the area crop: `cleaned` = marks were
     *  removed before reading (verify); `unread` = marks dominated, so nothing
     *  was auto-read and it must be entered from the crop. */
    areaCorrection?: 'cleaned' | 'unread';
    /** Pre-filled comments, from a filled PDF, OCR, or prior entry. */
    comments?: string;
    /** Cropped handwriting regions (scan only) shown while OCR runs. */
    crops?: { key: string; label: string; kind: 'line' | 'box'; dataUrl: string; image: GrayImage; hasInk: boolean }[];
    /** True while handwriting recognition is still running on the crops. */
    ocrBusy?: boolean;
    /** The bothersome-area region carried content (ink on a scan, typed text in
     *  a PDF), so the reviewer must confirm it and the field is highlighted. */
    requireArea?: boolean;
    /** The comments region carried ink/text; the field is highlighted for
     *  attention only (optional — comments aren't OCR'd, so nothing to verify). */
    commentsDetected?: boolean;
    /** Scan channel only: the read resolved no answers at all. Usually the
     *  wrong form (a photo can't be identity-checked the way a filled PDF is)
     *  or an unreadable/blank sheet — surfaced as a warning banner in review. */
    emptyScan?: boolean;
    /** This review is one step of a combined "completed tests" upload. Its
     *  `pdfUrl` points at the shared combined document (not revoked between
     *  steps), and `queueRemaining` counts the tests still to confirm after it. */
    pdfFromCombined?: boolean;
    queueRemaining?: number;
    attention: string[];
  } | null>(null);

  // Combined "upload completed tests" state — a single PDF holding one or more
  // filled sheets, split into a per-test review queue.
  // The upload modal (drag-and-drop / browse) is open.
  let combinedOpen = $state(false);
  let combinedDragActive = $state(false);
  let combinedBusy = $state(false);
  let combinedError = $state<string | null>(null);
  // Object URL of the uploaded combined PDF, shown beside every step's form.
  // Held here (not on `omrReview`) so it survives across the queue and is
  // revoked once, when the queue finishes or is abandoned.
  let combinedPdfUrl = $state<string | null>(null);
  // Tests still awaiting confirmation after the one currently in review.
  type QueuedReview = {
    child: ChildAssessment;
    response: Record<string, number>;
    area?: string;
    comments?: string;
    requireArea: boolean;
    commentsDetected: boolean;
    attention: string[];
  };
  let reviewQueue = $state<QueuedReview[]>([]);
  // How many tests this combined upload is stepping through in total, so the
  // review header can read "Test 2 of 3" even on a partial upload.
  let combinedTotal = $state(0);

  onMount(() => {
    role = storeGet<Role>(KEYS.role);
    if (!role) {
      window.location.replace('/pain-classification/');
      return;
    }
    // Seed working state from anything already saved.
    for (const child of ACUTE_CHILDREN) {
      const savedValues = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
      if (savedValues) values[child.slug] = { ...savedValues };
      const savedComment = storeGet<string>(KEYS.commentPrefix + child.slug);
      if (savedComment) comments[child.slug] = savedComment;
      const savedResponse = storeGet<Record<string, unknown>>(child.slug + ':response');
      if (typeof savedResponse?.bothersome_area === 'string') areas[child.slug] = savedResponse.bothersome_area;
    }
    loaded = true;
  });

  function childComplete(child: ChildAssessment): boolean {
    const v = values[child.slug];
    return !!v && child.manualFields.every((f) => typeof v[f.key] === 'number' && Number.isFinite(v[f.key]));
  }

  const doneCount = $derived(ACUTE_CHILDREN.filter((c) => childComplete(c)).length);
  const allDone = $derived(doneCount === ACUTE_CHILDREN.length);

  // Patients get an entirely different experience (a one-test-per-page flow,
  // no scoring), rendered by PatientAssessmentFlow; everything below in this
  // component is the professional collection view.
  const isPatient = $derived(role === 'patient');

  /** Persist a child's values to storage, keeping only finite numbers. */
  function persistValues(slug: string): void {
    const v = values[slug] ?? {};
    const clean: Record<string, number> = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'number' && Number.isFinite(val)) clean[k] = val;
    }
    if (Object.keys(clean).length > 0) storeSet(KEYS.manualPrefix + slug, clean);
    else storeRemove(KEYS.manualPrefix + slug);
  }

  function setField(slug: string, key: string, raw: number): void {
    const value = Number.isFinite(raw) ? raw : undefined;
    values = { ...values, [slug]: { ...(values[slug] ?? {}), [key]: value } };
    persistValues(slug);
  }

  function setComment(slug: string, text: string): void {
    comments = { ...comments, [slug]: text };
    const trimmed = text.trim();
    if (trimmed) storeSet(KEYS.commentPrefix + slug, trimmed);
    else storeRemove(KEYS.commentPrefix + slug);
  }

  /**
   * Persist the free-text bothersome area typed on the card (FreBAQ only)
   * into the child's `${slug}:response`, the same place a completed
   * questionnaire or scanned sheet writes it — so it survives a reload and
   * pre-fills the questionnaire if opened.
   */
  function setArea(slug: string, text: string): void {
    areas = { ...areas, [slug]: text };
    const trimmed = sanitizeBothersomeArea(text);
    const response = storeGet<Record<string, unknown>>(slug + ':response') ?? {};
    if (trimmed) response.bothersome_area = trimmed;
    else delete response.bothersome_area;
    if (Object.keys(response).length > 0) storeSet(slug + ':response', response);
    else storeRemove(slug + ':response');
  }

  function openQuestionnaire(child: ChildAssessment): void {
    // Role-gated children (MSI) read their role from storage on mount, so it
    // must be set before the survey renders — otherwise the survey redirects.
    if (child.roleKey && role) storeSet(child.roleKey, role);
    modalProgress = 0;
    modalChild = child;
  }

  function closeQuestionnaire(): void {
    modalChild = null;
  }

  /**
   * Called by the embedded survey after it scores and persists its result.
   * Pull the computed field values into the inline inputs, and carry any
   * comment typed in the questionnaire over to the card's comment box.
   */
  function finishQuestionnaire(child: ChildAssessment): void {
    const extracted = child.fromResult(storeGet(child.resultKey));
    if (extracted) {
      values = { ...values, [child.slug]: { ...extracted } };
      persistValues(child.slug);
    }
    const response = storeGet<Record<string, unknown>>(child.slug + ':response');
    const comment = typeof response?.other_comments === 'string' ? response.other_comments : '';
    if (comment) setComment(child.slug, comment);
    if (typeof response?.bothersome_area === 'string' && response.bothersome_area) {
      areas = { ...areas, [child.slug]: response.bothersome_area };
    }
    modalChild = null;
  }

  /** Open the upload modal (drag-and-drop or browse) for a child. */
  function startUpload(child: ChildAssessment): void {
    if (!child.omrTemplate) return;
    omrError = null;
    dragActive = false;
    uploadChild = child;
  }

  /** Close the upload modal, unless a read is in progress. */
  function closeUpload(): void {
    if (omrBusy) return;
    uploadChild = null;
    omrError = null;
    dragActive = false;
  }

  function onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (!omrBusy) dragActive = true;
  }

  function onDragLeave(e: DragEvent): void {
    e.preventDefault();
    dragActive = false;
  }

  function onDrop(e: DragEvent): void {
    e.preventDefault();
    dragActive = false;
    if (omrBusy) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) void ingestFile(file);
  }

  /** Browse-input handler: hand the chosen file to the reader. */
  function onFileChosen(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file
    if (file) void ingestFile(file);
  }

  /**
   * Read an uploaded file (dropped or browsed), then open the confirmation
   * review on success. A PDF is a form filled on a computer — read its radio
   * answers back exactly; any other file is a scan/photo and goes through OMR.
   */
  async function ingestFile(file: File): Promise<void> {
    const child = uploadChild;
    if (!file || !child?.omrTemplate) return;

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

    omrError = null;
    omrBusy = child.slug;
    try {
      const result = isPdf
        ? await readPdfFormFromBlob(file, child.omrTemplate)
        : await readSheetFromBlob(file, child.omrTemplate);
      if (!result.ok) {
        omrError =
          (result.error ?? 'Could not read the file.') +
          (isPdf ? '' : ' Make sure the whole sheet is visible, well-lit, and reasonably flat.');
        return;
      }
      // A comment / bothersome area typed into the PDF flows into the same
      // places a questionnaire's would.
      if (isPdf && result.text?.other_comments) setComment(child.slug, result.text.other_comments);
      const pdfArea =
        isPdf && typeof result.text?.bothersome_area === 'string'
          ? sanitizeBothersomeArea(result.text.bothersome_area)
          : '';
      if (pdfArea) areas = { ...areas, [child.slug]: pdfArea };
      // Role-gated children (MSI) need their role set before the survey renders.
      if (child.roleKey && role) storeSet(child.roleKey, role);
      // A scan carries handwriting crops to recognize; a filled PDF carries
      // exact typed text and no crops.
      const crops =
        !isPdf && result.textCrops?.length
          ? result.textCrops.map((c) => ({
              key: c.key,
              label: c.label,
              kind: c.kind,
              dataUrl: grayImageToDataURL(c.image),
              image: c.image,
              hasInk: c.hasInk,
            }))
          : undefined;
      // Only recognize short single-line fields (the bothersome area) that
      // actually have ink. Multi-line boxes (comments) are slow and low-value
      // to OCR, so we skip them and require the reviewer to type them in.
      const ocrCrops = crops?.filter((c) => c.kind === 'line' && c.hasInk);
      // Pin the bothersome-area crop next to its field so the reviewer can
      // read the handwriting directly — the safety net when OCR of a
      // crossed-out / scribbled correction is unreliable.
      const areaCrop = crops?.find((c) => c.key === 'bothersome_area' && c.hasInk);
      omrReview = {
        child,
        imageUrl: result.warped ? grayImageToDataURL(result.warped) : null,
        // Show the filled PDF itself side-by-side, the way a scan shows its
        // flattened image. Rendered natively by the browser via an object URL.
        pdfUrl: isPdf ? URL.createObjectURL(file) : undefined,
        response: result.response,
        area: pdfArea || areas[child.slug],
        areaCropUrl: areaCrop?.dataUrl,
        comments: (isPdf ? result.text?.other_comments : undefined) ?? comments[child.slug],
        crops: ocrCrops?.length ? ocrCrops : undefined,
        ocrBusy: !!ocrCrops?.length,
        // The bothersome-area region must be confirmed by the reviewer when it
        // carries content: ink on a scan (even if OCR couldn't read it) or typed
        // text in a filled PDF. Comments are only flagged for attention.
        requireArea: isPdf
          ? !!pdfArea
          : crops?.some((c) => c.key === 'bothersome_area' && c.hasInk),
        commentsDetected: isPdf
          ? !!result.text?.other_comments
          : crops?.some((c) => c.key === 'other_comments' && c.hasInk),
        // A scan that registered but resolved nothing is the tell for a wrong
        // form or an unreadable sheet — the reader can't identity-check a photo,
        // so we flag it for the reviewer rather than presenting empty answers.
        emptyScan: !isPdf && Object.keys(result.response).length === 0,
        attention: result.attention,
      };
      uploadChild = null; // success → close the upload modal; the review opens
      if (ocrCrops?.length) void runHandwritingOcr(ocrCrops);
    } catch (err) {
      omrError = err instanceof Error ? err.message : 'Could not read the file.';
    } finally {
      omrBusy = null;
    }
  }

  /** Free the uploaded-PDF object URL, if any, before dropping the review. The
   *  combined document's URL is shared across the queue and freed separately
   *  (see `endCombinedReview`), so it is left alone here. */
  function revokeReviewPdf(): void {
    if (omrReview?.pdfUrl && !omrReview.pdfFromCombined) URL.revokeObjectURL(omrReview.pdfUrl);
  }

  function closeReview(): void {
    // Closing a combined step abandons the rest of the queue.
    if (omrReview?.pdfFromCombined) {
      endCombinedReview();
      omrReview = null;
      return;
    }
    revokeReviewPdf();
    omrReview = null;
  }

  /**
   * Recognize handwriting in each cropped region and pre-fill the matching
   * review field. Best-effort: unrecognized crops just leave the field blank
   * for manual entry. The survey renders once this finishes (or is skipped).
   */
  async function runHandwritingOcr(
    crops: { key: string; image: GrayImage }[],
  ): Promise<void> {
    const { recognizeHandwriting } = await import('../lib/omr/handwriting');
    for (const c of crops) {
      const { text, corrected, dominated } = await recognizeHandwriting(c.image);
      if (!omrReview) return; // review was closed mid-recognition
      if (c.key === 'bothersome_area') {
        // Faithful transcription: pre-fill exactly what OCR read from the
        // correction-cleaned crop — no vocabulary interpretation. When
        // correction marks dominate, leave the field empty and flag it so the
        // reviewer reads it from the pinned crop instead of confirming a guess.
        omrReview = {
          ...omrReview,
          area: dominated ? '' : sanitizeBothersomeArea(text),
          areaCorrection: dominated ? 'unread' : corrected ? 'cleaned' : undefined,
        };
      }
    }
    if (omrReview) omrReview = { ...omrReview, ocrBusy: false };
  }

  /** Stop waiting on recognition and confirm the answers manually. */
  function skipOcr(): void {
    if (omrReview) omrReview = { ...omrReview, ocrBusy: false };
  }

  /** The user confirmed the scanned answers via the embedded survey (which
   *  has already scored and persisted the result); fold it into the card. In a
   *  combined upload, advance to the next queued test instead of closing. */
  function finishReview(child: ChildAssessment): void {
    finishQuestionnaire(child);
    if (omrReview?.pdfFromCombined) {
      openNextReview();
      return;
    }
    revokeReviewPdf();
    omrReview = null;
  }

  /** Open the combined "upload completed tests" modal. */
  function startCombinedUpload(): void {
    combinedError = null;
    combinedDragActive = false;
    combinedOpen = true;
  }

  /** Close the combined upload modal, unless a read is in progress. */
  function closeCombinedUpload(): void {
    if (combinedBusy) return;
    combinedOpen = false;
    combinedError = null;
    combinedDragActive = false;
  }

  function onCombinedDragOver(e: DragEvent): void {
    e.preventDefault();
    if (!combinedBusy) combinedDragActive = true;
  }

  function onCombinedDragLeave(e: DragEvent): void {
    e.preventDefault();
    combinedDragActive = false;
  }

  function onCombinedDrop(e: DragEvent): void {
    e.preventDefault();
    combinedDragActive = false;
    if (combinedBusy) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) void ingestCombined(file);
  }

  function onCombinedFileChosen(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void ingestCombined(file);
  }

  /**
   * Read an uploaded completed-tests PDF, split it into per-assessment reads,
   * and open a review queue stepping through each filled test in turn. Only a
   * PDF is accepted here — it's the fillable document the patient flow produces
   * and forwards; per-test scans stay on each card's own upload.
   */
  async function ingestCombined(file: File): Promise<void> {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      combinedError =
        'Upload the completed-tests PDF here. For a photo or scan of a printed ' +
        'sheet, use the individual test card below.';
      return;
    }

    combinedError = null;
    combinedBusy = true;
    try {
      const templates = ACUTE_CHILDREN.map((c) => c.omrTemplate).filter(
        (t): t is NonNullable<typeof t> => !!t,
      );
      const read = await readCombinedPdfFormFromBlob(file, templates);
      if (!read.ok) {
        combinedError = read.error;
        return;
      }

      // Map each read back to its child (by template id), in card order, and
      // build the review queue. Reads whose assessment isn't a known child are
      // ignored defensively.
      const bySlug = new Map(ACUTE_CHILDREN.map((c) => [c.omrTemplate?.id, c] as const));
      const queue: QueuedReview[] = [];
      for (const c of ACUTE_CHILDREN) {
        const match = read.children.find((r) => r.templateId === c.omrTemplate?.id);
        if (!match || !bySlug.has(match.templateId)) continue;
        const text = match.result.text ?? {};
        const area =
          typeof text.bothersome_area === 'string'
            ? sanitizeBothersomeArea(text.bothersome_area)
            : '';
        const comments = typeof text.other_comments === 'string' ? text.other_comments : '';
        queue.push({
          child: c,
          response: match.result.response,
          area: area || undefined,
          comments: comments || undefined,
          requireArea: !!area,
          commentsDetected: !!comments,
          attention: match.result.attention,
        });
      }

      if (queue.length === 0) {
        combinedError =
          "We couldn't match this PDF to any of the four assessments. Upload the " +
          'completed-tests PDF you downloaded here.';
        return;
      }

      combinedPdfUrl = URL.createObjectURL(file);
      reviewQueue = queue;
      combinedTotal = queue.length;
      combinedOpen = false;
      openNextReview();
    } catch (err) {
      combinedError = err instanceof Error ? err.message : 'Could not read the file.';
    } finally {
      combinedBusy = false;
    }
  }

  /** Advance to the next queued test's confirmation, or finish the queue. */
  function openNextReview(): void {
    const next = reviewQueue[0];
    if (!next) {
      endCombinedReview();
      omrReview = null;
      return;
    }
    reviewQueue = reviewQueue.slice(1);
    const { child } = next;
    // Role-gated children (MSI) need their role set before the survey renders.
    if (child.roleKey && role) storeSet(child.roleKey, role);
    // Reflect any carried free-text on the card and in storage, so the review
    // pre-fills and the card stays consistent if confirmed.
    if (next.comments) setComment(child.slug, next.comments);
    if (next.area) setArea(child.slug, next.area);
    omrReview = {
      child,
      imageUrl: null,
      pdfUrl: combinedPdfUrl ?? undefined,
      pdfFromCombined: true,
      queueRemaining: reviewQueue.length,
      response: next.response,
      area: next.area,
      comments: next.comments,
      requireArea: next.requireArea,
      commentsDetected: next.commentsDetected,
      attention: next.attention,
    };
  }

  /** Tear down the combined review: drop any remaining queue and free the
   *  shared PDF object URL. */
  function endCombinedReview(): void {
    reviewQueue = [];
    combinedTotal = 0;
    if (combinedPdfUrl) {
      URL.revokeObjectURL(combinedPdfUrl);
      combinedPdfUrl = null;
    }
  }

  function onWindowKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    if (uploadChild) closeUpload();
    else if (combinedOpen) closeCombinedUpload();
    else if (omrReview) closeReview();
    else if (modalChild) closeQuestionnaire();
  }

  function proceed(): void {
    if (!allDone) return;
    window.location.href = '/pain-classification/results/';
  }
</script>

<svelte:window onkeydown={onWindowKey} />

{#if loaded}
  {#if isPatient}
    <PatientAssessmentFlow />
  {:else}
  <section class="collect">
    <a class="collect__back" href="/pain-classification/">&larr; Go back</a>
    <h1 class="collect__heading">Acute Pain Classification</h1>
    <p class="collect__lede">
      Provide a result for each of the four assessments below — either enter a
      known result manually, take the test directly, or download the test,
      complete and upload it. When all four are complete, calculate the
      composite classification.
    </p>

    <div class="bulk">
      <div class="bulk__text">
        <span class="material-symbols-outlined bulk__icon" aria-hidden="true">upload_file</span>
        <div>
          <p class="bulk__title">Have a completed-tests PDF from the patient?</p>
          <p class="bulk__desc">
            Upload the single PDF they filled out and shared — we'll read every
            test it contains and step you through confirming each one. It can hold
            all four assessments or just some.
          </p>
        </div>
      </div>
      <button type="button" class="btn btn--primary bulk__btn" onclick={startCombinedUpload}>
        <span class="material-symbols-outlined" aria-hidden="true">upload</span>
        Upload completed tests
      </button>
    </div>

    <ul class="cards">
      {#each ACUTE_CHILDREN as child, i (child.slug)}
        <li class="assessment">
          <div class="card" class:card--done={childComplete(child)}>
            <header class="card__header">
              <div class="card__lead">
                <span class="card__num" class:card__num--done={childComplete(child)} aria-hidden="true">{i + 1}</span>
                <div class="card__heading">
                  <h2 class="card__title">{child.shortName}</h2>
                  <p class="card__subtitle">{child.description}</p>
                </div>
              </div>
              <div class="card__actions">
                <button type="button" class="btn btn--success card__btn" onclick={() => openQuestionnaire(child)}>
                  Take the test
                </button>
                {#if child.omrTemplate}
                  <OmrSheetButton template={child.omrTemplate} label="Download test" compact={true} />
                  <div class="omr-sheet omr-sheet--compact">
                    <button
                      type="button"
                      class="btn btn--secondary btn--compact-block"
                      onclick={() => startUpload(child)}
                      disabled={omrBusy === child.slug}
                    >
                      <span class="material-symbols-outlined" aria-hidden="true">upload</span>
                      {omrBusy === child.slug ? 'Reading…' : 'Upload test'}
                    </button>
                  </div>
                {/if}
              </div>
            </header>

            <div class="card__body">
            {#if child.areaField}
              <label class="field field--area">
                <span class="field__label">{child.areaField.label}</span>
                <input
                  class="field__input field__input--area"
                  type="text"
                  placeholder={child.areaField.placeholder}
                  value={areas[child.slug] ?? ''}
                  oninput={(e) => setArea(child.slug, (e.currentTarget as HTMLInputElement).value)}
                />
              </label>
            {/if}
            <div class="card__fields">
              {#each child.manualFields as f (f.key)}
                <label class="field">
                  <span class="field__label">
                    {f.label} <span class="field__range">({f.min}–{f.max})</span>
                  </span>
                  <input
                    class="field__input"
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step ?? 1}
                    value={values[child.slug]?.[f.key] ?? ''}
                    oninput={(e) => setField(child.slug, f.key, (e.currentTarget as HTMLInputElement).valueAsNumber)}
                  />
                </label>
              {/each}

              <label class="field field--comment">
                <span class="field__label">Comments (optional)</span>
                <textarea
                  class="field__textarea"
                  rows="2"
                  placeholder="Any notes about this assessment…"
                  value={comments[child.slug] ?? ''}
                  oninput={(e) => setComment(child.slug, (e.currentTarget as HTMLTextAreaElement).value)}
                ></textarea>
              </label>
            </div>
            </div>
          </div>
        </li>
      {/each}
    </ul>

    <div class="collect__footer">
      {#if !allDone}
        <p class="collect__hint">
          {ACUTE_CHILDREN.length - doneCount} of {ACUTE_CHILDREN.length} assessments still need a result.
        </p>
      {/if}
      <button type="button" class="btn btn--primary collect__calc" disabled={!allDone} onclick={proceed}>
        Calculate Results
      </button>
    </div>
  </section>

  {#if modalChild}
    {@const child = modalChild}
    <div
      class="modal-overlay"
      role="presentation"
      onclick={(e) => { if (e.target === e.currentTarget) closeQuestionnaire(); }}
    >
      <div class="modal" role="dialog" aria-modal="true" aria-label={`${child.shortName} questionnaire`}>
        <header class="modal__head">
          <div class="modal__head-row">
            <div>
              <h2 class="modal__title">{child.shortName}</h2>
              <p class="modal__subtitle">{child.description}</p>
            </div>
            <button type="button" class="modal__close" aria-label="Close questionnaire" onclick={closeQuestionnaire}>
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
          <div class="modal__progress" aria-hidden="true">
            <div class="modal__progress-bar" style:width={`${Math.round(modalProgress * 100)}%`}></div>
          </div>
        </header>
        <div class="modal__body">
          {#if child.slug === 'msi'}
            <MSISurvey initialComments={comments[child.slug]} onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {:else if child.slug === 'briefslanss'}
            <BriefSLANSSSurvey initialComments={comments[child.slug]} onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {:else if child.slug === 'frebaq'}
            <FreBAQSurvey initialArea={areas[child.slug]} initialComments={comments[child.slug]} onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {:else if child.slug === 'phq4'}
            <PHQ4Survey initialComments={comments[child.slug]} onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if uploadChild}
    {@const uc = uploadChild}
    <div
      class="modal-overlay"
      role="presentation"
      onclick={(e) => { if (e.target === e.currentTarget) closeUpload(); }}
    >
      <div class="modal modal--narrow" role="dialog" aria-modal="true" aria-label={`Upload ${uc.shortName} answer sheet`}>
        <header class="modal__head">
          <div class="modal__head-row">
            <div>
              <h2 class="modal__title">Upload {uc.shortName} answer sheet</h2>
              <p class="modal__subtitle">
                The {uc.shortName} answer sheet — filled in on-screen, or a photo/scan
                of the printed one. Not the results PDF.
              </p>
            </div>
            <button type="button" class="modal__close" aria-label="Close" onclick={closeUpload}>
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        </header>
        <div class="modal__body">
          <label
            class="dropzone"
            class:dropzone--active={dragActive}
            class:dropzone--busy={omrBusy === uc.slug}
            ondragover={onDragOver}
            ondragleave={onDragLeave}
            ondrop={onDrop}
          >
            <input
              type="file"
              accept="image/*,application/pdf"
              class="visually-hidden"
              onchange={onFileChosen}
              disabled={omrBusy === uc.slug}
            />
            <span class="material-symbols-outlined dropzone__icon" aria-hidden="true">
              {omrBusy === uc.slug ? 'hourglass_top' : 'upload_file'}
            </span>
            {#if omrBusy === uc.slug}
              <span class="dropzone__text">Reading…</span>
            {:else}
              <span class="dropzone__text"><strong>Drag a file here</strong>, or click to browse</span>
              <span class="dropzone__hint">PDF, photo, or scan · one sheet</span>
            {/if}
          </label>
          {#if omrError}
            <p class="dropzone__error" role="alert">{omrError}</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if combinedOpen}
    <div
      class="modal-overlay"
      role="presentation"
      onclick={(e) => { if (e.target === e.currentTarget) closeCombinedUpload(); }}
    >
      <div class="modal modal--narrow" role="dialog" aria-modal="true" aria-label="Upload completed tests">
        <header class="modal__head">
          <div class="modal__head-row">
            <div>
              <h2 class="modal__title">Upload completed tests</h2>
              <p class="modal__subtitle">
                The single PDF the patient filled out and shared. We'll read every
                test it holds — all four, or just the ones they completed.
              </p>
            </div>
            <button type="button" class="modal__close" aria-label="Close" onclick={closeCombinedUpload}>
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        </header>
        <div class="modal__body">
          <label
            class="dropzone"
            class:dropzone--active={combinedDragActive}
            class:dropzone--busy={combinedBusy}
            ondragover={onCombinedDragOver}
            ondragleave={onCombinedDragLeave}
            ondrop={onCombinedDrop}
          >
            <input
              type="file"
              accept="application/pdf"
              class="visually-hidden"
              onchange={onCombinedFileChosen}
              disabled={combinedBusy}
            />
            <span class="material-symbols-outlined dropzone__icon" aria-hidden="true">
              {combinedBusy ? 'hourglass_top' : 'upload_file'}
            </span>
            {#if combinedBusy}
              <span class="dropzone__text">Reading…</span>
            {:else}
              <span class="dropzone__text"><strong>Drag the PDF here</strong>, or click to browse</span>
              <span class="dropzone__hint">The completed-tests PDF · one file</span>
            {/if}
          </label>
          {#if combinedError}
            <p class="dropzone__error" role="alert">{combinedError}</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if omrReview}
    {@const rv = omrReview}
    <div
      class="modal-overlay"
      role="presentation"
      onclick={(e) => { if (e.target === e.currentTarget) closeReview(); }}
    >
      <div class="modal" role="dialog" aria-modal="true" aria-label={`Review ${rv.child.shortName}`}>
        <header class="modal__head">
          <div class="modal__head-row">
            <div>
              {#if rv.pdfFromCombined}
                <p class="review__step">Test {combinedTotal - (rv.queueRemaining ?? 0)} of {combinedTotal} · {(rv.queueRemaining ?? 0) > 0 ? `${rv.queueRemaining} still to confirm` : 'last one'}</p>
              {/if}
              <h2 class="modal__title">Review {rv.imageUrl ? 'scanned' : 'filled'} {rv.child.shortName}</h2>
              <p class="modal__subtitle">
                {rv.imageUrl
                  ? 'We read your sheet — check the answers against the scan, correct any, then confirm.'
                  : 'We read your filled PDF — check the answers against it, correct any, then confirm.'}
              </p>
            </div>
            <button type="button" class="modal__close" aria-label="Close" onclick={closeReview}>
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        </header>
        <div class="modal__body review" class:review--noscan={!rv.imageUrl && !rv.pdfUrl}>
          {#if rv.imageUrl}
            <div class="review__scan">
              <img class="review__img" src={rv.imageUrl} alt={`Flattened scan of the ${rv.child.shortName} answer sheet`} />
            </div>
          {:else if rv.pdfUrl}
            <div class="review__scan">
              <iframe class="review__pdf" src={rv.pdfUrl} title={`Uploaded ${rv.child.shortName} PDF`}></iframe>
            </div>
          {/if}
          <div class="review__form">
            {#if rv.emptyScan}
              <p class="review__warn" role="alert">
                No answers were detected on this scan. Check you uploaded the
                {rv.child.shortName} answer sheet — not another assessment's sheet or a
                results report — and that the whole sheet is visible, flat, and well-lit.
              </p>
            {/if}
            {#if rv.ocrBusy}
              <div class="ocr-panel">
                <p class="ocr-panel__status">
                  <span class="ocr-panel__spinner" aria-hidden="true"></span>
                  Reading handwriting… this can take a moment the first time.
                </p>
                {#each rv.crops ?? [] as c (c.key)}
                  <figure class="ocr-crop">
                    <figcaption class="ocr-crop__label">{c.label}</figcaption>
                    <img class="ocr-crop__img" src={c.dataUrl} alt={`Scanned ${c.label}`} />
                  </figure>
                {/each}
                <button type="button" class="btn btn--secondary" onclick={skipOcr}>
                  Skip and enter manually
                </button>
              </div>
            {:else}
            {#if rv.child.slug === 'msi'}
              <MSISurvey
                initialAnswers={rv.response}
                initialComments={rv.comments}
                commentsDetected={rv.commentsDetected}
                attentionKeys={rv.attention}
                onComplete={() => finishReview(rv.child)}
                submitLabel={rv.pdfFromCombined && (rv.queueRemaining ?? 0) > 0 ? 'Confirm & next' : 'Confirm'}
                showProgress={false}
              />
            {:else if rv.child.slug === 'briefslanss'}
              <BriefSLANSSSurvey
                initialAnswers={rv.response}
                initialComments={rv.comments}
                commentsDetected={rv.commentsDetected}
                attentionKeys={rv.attention}
                onComplete={() => finishReview(rv.child)}
                submitLabel={rv.pdfFromCombined && (rv.queueRemaining ?? 0) > 0 ? 'Confirm & next' : 'Confirm'}
                showProgress={false}
              />
            {:else if rv.child.slug === 'frebaq'}
              <FreBAQSurvey
                initialAnswers={rv.response}
                initialArea={rv.area}
                initialComments={rv.comments}
                requireArea={rv.requireArea}
                commentsDetected={rv.commentsDetected}
                areaCropUrl={rv.areaCropUrl}
                areaCorrection={rv.areaCorrection}
                attentionKeys={rv.attention}
                onComplete={() => finishReview(rv.child)}
                submitLabel={rv.pdfFromCombined && (rv.queueRemaining ?? 0) > 0 ? 'Confirm & next' : 'Confirm'}
                showProgress={false}
              />
            {:else if rv.child.slug === 'phq4'}
              <PHQ4Survey
                initialAnswers={rv.response}
                initialComments={rv.comments}
                commentsDetected={rv.commentsDetected}
                attentionKeys={rv.attention}
                onComplete={() => finishReview(rv.child)}
                submitLabel={rv.pdfFromCombined && (rv.queueRemaining ?? 0) > 0 ? 'Confirm & next' : 'Confirm'}
                showProgress={false}
              />
            {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
  {/if}

{/if}

<style>
  .collect__back {
    display: inline-block;
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
    border-bottom: none;
  }

  .collect__heading {
    margin-bottom: var(--space-3);
  }

  .collect__lede {
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
  }

  /* Bulk "upload completed tests" callout: sits above the per-test cards as the
     fast path when a patient shares one filled PDF. Tinted so it reads as a
     distinct shortcut, not another assessment card. */
  .bulk {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    padding: var(--space-4) var(--space-5);
    background: var(--color-primary-tint-ghost);
    border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
    border-radius: var(--radius-lg);
  }

  .bulk__text {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-width: 0;
  }

  .bulk__icon {
    flex-shrink: 0;
    color: var(--color-primary);
    font-size: 1.5rem;
  }

  .bulk__title {
    margin: 0;
    font-weight: 600;
    font-size: 0.98rem;
  }

  .bulk__desc {
    margin: var(--space-1) 0 0 0;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-text-muted);
  }

  .bulk__btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    font-size: 0.9rem;
    white-space: nowrap;
  }
  .bulk__btn .material-symbols-outlined {
    font-size: 1.1rem;
  }

  @media (max-width: 640px) {
    .bulk {
      flex-direction: column;
      align-items: stretch;
    }
    .bulk__btn {
      justify-content: center;
    }
  }

  /* Step counter above the review title during a combined upload's queue. */
  .review__step {
    margin: 0 0 var(--space-1) 0;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--color-primary);
  }

  .cards {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-7) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .card {
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
    overflow: hidden; /* clip the header background to the rounded corners */
  }

  .card--done {
    border-color: var(--color-success);
  }

  /* Header band: assessment heading on the left, action button(s) on the
     right. White background, separated from the body by a bottom border. */
  .card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }

  .card--done .card__header {
    border-bottom-color: var(--color-success);
  }

  /* Number badge + heading grouped on the left of the header band. */
  .card__lead {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  /* Numbered badge so each assessment reads as an ordered step. */
  .card__num {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: var(--color-primary-tint-ghost);
    color: var(--color-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
  }

  .card__num--done {
    background: var(--color-success);
    color: #fff;
  }

  .card__heading {
    min-width: 0;
  }

  .card__title {
    font-size: 1.1rem;
    margin: 0;
  }

  .card__subtitle {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin: var(--space-1) 0 0 0;
  }

  /* Action button group — column so a second (e.g. "Upload image") button
     stacks neatly beneath the first at matching width. */
  .card__actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .card__btn {
    padding: var(--space-2) var(--space-4);
    font-size: 0.85rem;
  }

  .card__body {
    padding: var(--space-5);
  }

  .field--area {
    margin-bottom: var(--space-4);
  }

  .field__input--area {
    width: 100%;
    max-width: 28rem;
  }

  .card__fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field--comment {
    width: 100%;
  }

  .field__label {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .field__range {
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .field__input {
    width: 8rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .field__textarea {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.95rem;
    resize: vertical;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .field__input:focus,
  .field__textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  .btn--success {
    background: var(--color-success);
    color: #fff;
    white-space: nowrap;
  }
  .btn--success:hover {
    filter: brightness(0.93);
  }

  @media (max-width: 640px) {
    .card__header {
      flex-direction: column;
      align-items: stretch;
    }
  }

  .collect__footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-3);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-6);
  }

  .collect__hint {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin: 0;
  }

  .collect__calc {
    padding: var(--space-3) var(--space-7);
    font-size: 1rem;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: var(--space-6) var(--space-4);
    background: rgba(0, 0, 0, 0.5);
    overflow-y: auto;
  }

  .modal {
    width: 100%;
    max-width: 980px;
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 2 * var(--space-6));
  }

  .modal__head {
    padding: var(--space-5) var(--space-5) 0;
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    background: var(--color-bg);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .modal__head-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    padding-bottom: var(--space-4);
  }

  /* Fixed progress track: lives in the sticky header, so its background
     stays put while the questionnaire body scrolls beneath it. */
  .modal__progress {
    height: 4px;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: -1px; /* sit flush over the header's bottom border */
  }

  .modal__progress-bar {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s ease-out;
  }

  .modal__title {
    margin: 0;
    font-size: 1.2rem;
  }

  .modal__subtitle {
    margin: var(--space-1) 0 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }

  .modal__close {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .modal__close:hover {
    background: var(--color-primary-tint-ghost);
    color: var(--color-text);
  }

  .modal__body {
    padding: var(--space-5);
    overflow-y: auto;
  }

  /* Visually-hidden file input (kept in the DOM for programmatic click). */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Review modal: flattened scan beside the pre-filled survey. Shares the base
     .modal width (980px) so it lines up with the "Take the test" modal. */
  .review {
    display: flex;
    gap: var(--space-6);
    align-items: flex-start;
  }

  /* No scan to show (a filled PDF): center the form at a comfortable width
     rather than stretching it across the wide review modal. */
  .review--noscan {
    justify-content: center;
  }
  .review--noscan .review__form {
    max-width: 620px;
  }

  .review__scan {
    flex: 0 0 40%;
    position: sticky;
    top: 0;
    align-self: flex-start;
  }

  .review__img {
    width: 100%;
    height: auto;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: #fff;
  }

  /* The uploaded PDF, rendered by the browser next to the form. Unlike an
     image it can't size to its content, so it gets a tall fixed viewport. */
  .review__pdf {
    display: block;
    width: 100%;
    height: 75vh;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: #fff;
  }

  .review__form {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* Warning banner shown above the review when a scan resolved no answers —
     the likely-wrong-form / unreadable-sheet safety net. */
  .review__warn {
    margin: 0 0 var(--space-4) 0;
    padding: var(--space-3);
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-warning) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning) 40%, transparent);
    border-radius: var(--radius-md);
  }

  /* Handwriting-recognition panel: shown while OCR runs on scanned crops. */
  .ocr-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
  }

  .ocr-panel__status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: 0.95rem;
    color: var(--color-text-muted);
  }

  .ocr-panel__spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: ocr-spin 0.7s linear infinite;
  }

  @keyframes ocr-spin {
    to { transform: rotate(360deg); }
  }

  .ocr-crop {
    margin: 0;
    width: 100%;
  }

  .ocr-crop__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-muted);
    margin-bottom: var(--space-1);
  }

  .ocr-crop__img {
    max-width: 100%;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm, 4px);
    background: #fff;
  }

  .modal--narrow {
    max-width: 440px;
  }

  /* Upload modal: drag-and-drop / click-to-browse target. The whole zone is a
     <label> wrapping a hidden file input, so a click anywhere opens the
     picker while drop events are handled directly. */
  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-7) var(--space-4);
    text-align: center;
    border: 2px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-alt);
    color: var(--color-text);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .dropzone:hover,
  .dropzone:focus-within {
    border-color: var(--color-primary);
    background: var(--color-primary-tint-ghost);
  }

  .dropzone--active {
    border-color: var(--color-primary);
    background: var(--color-primary-tint-soft);
  }

  .dropzone--busy {
    cursor: progress;
    opacity: 0.75;
  }

  .dropzone__icon {
    font-size: 2rem;
    color: var(--color-primary);
  }

  .dropzone__text {
    font-size: 0.95rem;
  }

  .dropzone__hint {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .dropzone__error {
    margin: var(--space-3) 0 0 0;
    padding: var(--space-3);
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
    border-radius: var(--radius-md);
  }

  @media (max-width: 720px) {
    .review {
      flex-direction: column;
    }
    .review__scan {
      position: static;
      flex-basis: auto;
      width: 100%;
      max-height: 40vh;
      overflow: auto;
    }
    /* Fit the PDF within the collapsed side panel so it doesn't nest a second
       scrollbar inside the container's own overflow. */
    .review__pdf {
      height: 38vh;
    }
  }
</style>
