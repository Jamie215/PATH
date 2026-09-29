<script lang="ts">
  /**
   * Confirmation of one uploaded test: the flattened scan (or the uploaded PDF)
   * beside the child's own survey pre-filled with what was read. While
   * handwriting recognition runs, its crops are shown with a skip option.
   */
  import Modal from '../Modal.svelte';
  import ChildSurvey from './ChildSurvey.svelte';
  import type { UploadFlow } from './upload-flow.svelte';

  let { flow }: { flow: UploadFlow } = $props();
  // Rendered only while a review is open.
  const rv = $derived(flow.review!);
  const step = $derived(flow.total - rv.queueRemaining);
</script>

<Modal
  eyebrow={`Test ${step} of ${flow.total} · ${rv.queueRemaining > 0 ? `${rv.queueRemaining} still to confirm` : 'last one'}`}
  title={`Review ${rv.imageUrl ? 'scanned' : 'filled'} ${rv.child.shortName}`}
  subtitle={rv.imageUrl
    ? 'We read your sheet — check the answers against the scan, correct any, then confirm.'
    : 'We read your filled PDF — check the answers against it, correct any, then confirm.'}
  size="wide"
  onClose={flow.closeReview}
>
  <div class="review" class:review--noscan={!rv.imageUrl && !rv.pdfUrl}>
    {#if rv.imageUrl}
      <div class="review__scan">
        <img class="review__img" src={rv.imageUrl} alt={`Flattened scan of the ${rv.child.shortName} answer sheet`} />
      </div>
    {:else if rv.pdfUrl}
      <div class="review__scan">
        <iframe
          class="review__pdf"
          src={`${rv.pdfUrl}#page=${(rv.pdfPage ?? 0) + 1}`}
          title={`Uploaded ${rv.child.shortName} PDF`}
        ></iframe>
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
          <p class="ocr-panel__status" role="status">
            <span class="ocr-panel__spinner" aria-hidden="true"></span>
            Reading handwriting… this can take a moment the first time.
          </p>
          {#each rv.crops ?? [] as c (c.key)}
            <figure class="ocr-crop">
              <figcaption class="ocr-crop__label">{c.label}</figcaption>
              <img class="ocr-crop__img" src={c.dataUrl} alt={`Scanned ${c.label}`} />
            </figure>
          {/each}
          <button type="button" class="btn btn--secondary" onclick={flow.skipOcr}>
            Skip and enter manually
          </button>
        </div>
      {:else}
        {#key rv.child.slug + step}
          <ChildSurvey
            slug={rv.child.slug}
            review
            initialAnswers={rv.response}
            initialArea={rv.area}
            initialComments={rv.comments}
            requireArea={rv.requireArea}
            commentsDetected={rv.commentsDetected}
            areaCropUrl={rv.areaCropUrl}
            areaCorrection={rv.areaCorrection}
            attentionKeys={rv.attention}
            onComplete={() => flow.confirmReview(rv.child)}
            submitLabel={rv.queueRemaining > 0 ? 'Confirm & next' : 'Confirm'}
            showProgress={false}
          />
        {/key}
      {/if}
    </div>
  </div>
</Modal>

<style>
  /* Flattened scan beside the pre-filled survey. */
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
    /* Half the wide modal goes to the sheet, so the photo/PDF reads large. */
    flex: 0 0 50%;
    position: sticky;
    top: 0;
    align-self: flex-start;
  }

  .review__img {
    width: 100%;
    height: auto;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg);
  }

  /* The uploaded PDF, rendered by the browser next to the form. Unlike an
     image it can't size to its content, so it gets a tall fixed viewport. */
  .review__pdf {
    display: block;
    width: 100%;
    height: 75vh;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg);
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
    background: var(--color-bg);
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
