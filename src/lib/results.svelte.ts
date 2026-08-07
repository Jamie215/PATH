/**
 * Shared reactive helpers for assessment results views.
 *
 * Every results component renders a "Patient name / ID" field and a
 * "Download PDF" button with identical behavior — only the storage key and
 * the PDF-producing call differ. These two small rune-based controllers own
 * that shared state and plumbing so each component supplies just the parts
 * unique to its assessment.
 *
 * This is a `.svelte.ts` module so Svelte runes (`$state`) work here and the
 * returned instances stay reactive when used from a component's template.
 */
import { get as storeGet, set as storeSet } from './storage';

/**
 * Patient name / ID field. `input` is bound to the text box; `display` is the
 * committed value shown in the heading and passed to the PDF. Both persist to
 * sessionStorage under `storageKey`.
 */
export class PatientNameField {
  input = $state('');
  display = $state('');
  #key: string;

  constructor(storageKey: string) {
    this.#key = storageKey;
  }

  /** Seed the field from a previously saved value (call from onMount). */
  load(): void {
    const saved = storeGet<string>(this.#key);
    if (saved) {
      this.input = saved;
      this.display = saved;
    }
  }

  /** Commit the trimmed input to the heading and to storage. */
  save = (): void => {
    const trimmed = this.input.trim();
    this.display = trimmed;
    storeSet(this.#key, trimmed);
  };

  /** Enter commits without submitting a surrounding form. */
  handleKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.save();
    }
  };

  /** Value to hand the report: committed name, or the current trimmed input. */
  get value(): string {
    return this.display || this.input.trim();
  }
}

/**
 * PDF download button state + plumbing. `run` toggles `busy`, captures any
 * error into `error`, and triggers the browser download of the produced
 * bytes. The caller's `produce` callback does the assessment-specific work
 * (lazy-import the generator, build the bytes and filename).
 */
export class PdfDownload {
  busy = $state(false);
  error = $state<string | null>(null);

  async run(produce: () => Promise<{ bytes: Uint8Array; filename: string }>): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const { bytes, filename } = await produce();
      triggerBlobDownload(bytes, filename, 'application/pdf');
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Could not generate the PDF.';
    } finally {
      this.busy = false;
    }
  }
}

/** Save `bytes` to the user's machine via a transient object-URL anchor. */
function triggerBlobDownload(bytes: Uint8Array, filename: string, type: string): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revocation so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
