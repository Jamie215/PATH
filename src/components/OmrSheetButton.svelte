<script lang="ts">
  /**
   * Downloads a blank, printable OMR answer sheet for a given assessment.
   *
   * The heavy PDF library is imported lazily on click (matching the report
   * download elsewhere in the app), so this button adds no weight to the
   * page until someone actually prints a sheet.
   */
  import type { OmrTemplate } from '../assessments/omr/types';

  let { template, label = 'Print blank answer sheet' }: {
    template: OmrTemplate;
    label?: string;
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

<div class="omr-sheet">
  <button type="button" class="btn btn--secondary" onclick={download} disabled={busy}>
    <span class="material-symbols-outlined" aria-hidden="true">print</span>
    {busy ? 'Preparing…' : label}
  </button>
  <p class="omr-sheet__hint">
    Print, fill out by hand, then scan or photograph it to enter results.
  </p>
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
