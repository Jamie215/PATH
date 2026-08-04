<script lang="ts">
  /**
   * Patient review view for the acute pain-classification pathway.
   *
   * Patients don't see any scoring or the composite classification (that's the
   * professional's results page). Instead, once every test is complete, they
   * land here to review their completed test forms in an embedded PDF viewer —
   * each form rendered with their own answers marked on it — and can download
   * that same PDF to hand to a clinician, or go back to make changes.
   *
   * Guards: no role → back to intake; any test still incomplete → back to the
   * collection page (this view is only meaningful once all four are done).
   */
  import { onMount, onDestroy } from 'svelte';
  import { get as storeGet } from '../lib/storage';
  import { ACUTE_CHILDREN, KEYS, type Role, type ChildAssessment } from '../assessments/pain-classification/config';

  let loaded = $state(false);
  let building = $state(false);
  let error = $state<string | null>(null);
  // Object URL of the combined PDF, shared by the viewer and the download.
  let pdfUrl = $state<string | null>(null);
  let filename = $state('completed_tests.pdf');

  function childComplete(child: ChildAssessment): boolean {
    const v = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
    return !!v && child.manualFields.every((f) => typeof v[f.key] === 'number' && Number.isFinite(v[f.key]));
  }

  onMount(() => {
    const role = storeGet<Role>(KEYS.role);
    if (!role) {
      window.location.replace('/pain-classification/');
      return;
    }
    if (!ACUTE_CHILDREN.every(childComplete)) {
      window.location.replace('/pain-classification/acute/');
      return;
    }
    loaded = true;
    void buildPdf();
  });

  onDestroy(() => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  });

  /**
   * Build one combined PDF: each completed test form rendered with the
   * patient's own answers marked on it (no scores, no interpretation). Answers
   * come from each child's stored survey `:response`, whose keys line up with
   * the sheet's fields; the current date is stamped on each form.
   */
  async function buildPdf(): Promise<void> {
    building = true;
    error = null;
    try {
      const { generateCombinedAnswerSheets, buildCombinedAnswerSheetFilename } = await import('../lib/omr-sheet');
      const today = new Date().toLocaleDateString();
      const entries = ACUTE_CHILDREN.filter((c) => c.omrTemplate).map((c) => {
        const response = storeGet<Record<string, number | string>>(c.slug + ':response') ?? {};
        return { template: c.omrTemplate!, answers: { ...response, patient_date: today } };
      });
      const bytes = await generateCombinedAnswerSheets(entries);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      pdfUrl = URL.createObjectURL(blob);
      filename = buildCombinedAnswerSheetFilename();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not prepare your completed tests.';
    } finally {
      building = false;
    }
  }

  function downloadPdf(): void {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function goBack(): void {
    window.location.href = '/pain-classification/acute/';
  }
</script>

{#if loaded}
  <section class="review">
    <a class="review__back" href="/pain-classification/acute/">&larr; Go back</a>
    <h1 class="review__heading">Review your completed tests</h1>
    <p class="review__lede">
      Review your completed tests below. Download a copy to keep or share with
      your healthcare professional, or go back to make changes.
    </p>

    <div class="viewer">
      {#if building}
        <div class="viewer__status">
          <span class="viewer__spinner" aria-hidden="true"></span>
          <span>Preparing your completed tests…</span>
        </div>
      {:else if error}
        <div class="viewer__status viewer__status--error" role="alert">
          <p>{error}</p>
          <button type="button" class="btn btn--secondary" onclick={() => buildPdf()}>Try again</button>
        </div>
      {:else if pdfUrl}
        <iframe class="viewer__frame" src={pdfUrl} title="Your completed tests"></iframe>
      {/if}
    </div>

    <div class="review__actions">
      <button type="button" class="btn btn--secondary" onclick={goBack}>
        Go back
      </button>
      <button
        type="button"
        class="btn btn--primary review__download"
        onclick={downloadPdf}
        disabled={!pdfUrl}
      >
        <span class="material-symbols-outlined" aria-hidden="true">download</span>
        Download completed tests
      </button>
    </div>
  </section>
{/if}

<style>
  .review__back {
    display: inline-block;
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
    border-bottom: none;
  }

  .review__heading {
    margin-bottom: var(--space-3);
  }

  .review__lede {
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
    max-width: 60ch;
  }

  /* Embedded viewer for the combined completed-tests PDF. */
  .viewer {
    margin-bottom: var(--space-6);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--color-bg-alt);
  }

  .viewer__frame {
    display: block;
    width: 100%;
    height: 78vh;
    min-height: 460px;
    border: 0;
    background: #fff;
  }

  .viewer__status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    min-height: 460px;
    padding: var(--space-6);
    text-align: center;
    color: var(--color-text-muted);
  }

  .viewer__status--error {
    color: var(--color-text);
  }

  .viewer__spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: viewer-spin 0.7s linear infinite;
  }

  @keyframes viewer-spin {
    to { transform: rotate(360deg); }
  }

  /* Centered actions below the viewer. */
  .review__actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-3);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-6);
  }

  .review__download {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-6);
    font-size: 1rem;
  }

  @media (max-width: 560px) {
    .review__actions {
      flex-direction: column-reverse;
      align-items: stretch;
    }
    .viewer__frame {
      height: 68vh;
    }
  }
</style>
