<script lang="ts">
  /**
   * Downloads a blank, printable OMR answer sheet for a given assessment.
   *
   * The heavy PDF library is imported lazily on click (matching the report
   * download elsewhere in the app), so this button adds no weight to the
   * page until someone actually prints a sheet.
   */
  import type { OmrTemplate } from '../assessments/omr/types';

  let { template, label = 'Download a copy', compact = false }: {
    template: OmrTemplate;
    label?: string;
    /** Hide the explanatory hint and shrink — for placing beside other buttons. */
    compact?: boolean;
  } = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);

  async function download(): Promise<void> {
    busy = true;
    error = null;
    try {
      const { generateAnswerSheet, buildAnswerSheetFilename } = await import('../lib/omr-sheet');
      const bytes = await generateAnswerSheet(template);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildAnswerSheetFilename(template);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not generate the answer sheet.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="omr-sheet" class:omr-sheet--compact={compact}>
  <button type="button" class="btn btn--secondary omr-sheet__btn" onclick={download} disabled={busy}>
    <span class="material-symbols-outlined" aria-hidden="true">download</span>
    {busy ? 'Preparing…' : label}
  </button>
  {#if !compact}
    <p class="omr-sheet__hint">
      Print, fill out by hand, then scan or photograph it to enter results.
    </p>
  {/if}
  {#if error}
    <p class="omr-sheet__error" role="alert">Could not generate the sheet: {error}</p>
  {/if}
</div>

<style>
  .omr-sheet {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-start;
  }

  .omr-sheet .btn {
    gap: var(--space-2);
  }

  .omr-sheet--compact .omr-sheet__btn {
    padding: var(--space-2) var(--space-4);
    font-size: 0.85rem;
    width: 100%;
  }

  .material-symbols-outlined {
    font-size: 1.1rem;
  }

  .omr-sheet__hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .omr-sheet__error {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-danger, #b43a3a);
  }
</style>
