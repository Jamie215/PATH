<script lang="ts">
  /**
   * Downloads a blank, printable OMR answer sheet for a given assessment.
   *
   * The heavy PDF library is imported lazily on click (matching the report
   * download elsewhere in the app), so this button adds no weight to the
   * page until someone actually prints a sheet.
   */
  import type { OmrTemplate } from '../assessments/omr/types';
  import { PdfDownload } from '../lib/results.svelte';

  let { template, label = 'Download a copy', compact = false }: {
    template: OmrTemplate;
    label?: string;
    /** Hide the explanatory hint and shrink — for placing beside other buttons. */
    compact?: boolean;
  } = $props();

  const sheet = new PdfDownload();

  function download(): Promise<void> {
    return sheet.run(async () => {
      const { generateAnswerSheet, buildAnswerSheetFilename } = await import('../lib/omr-sheet');
      return { bytes: await generateAnswerSheet(template), filename: buildAnswerSheetFilename(template) };
    });
  }
</script>

<div class="omr-sheet" class:omr-sheet--compact={compact}>
  <button type="button" class="btn btn--secondary omr-sheet__btn" class:btn--compact-block={compact} onclick={download} disabled={sheet.busy}>
    <span class="material-symbols-outlined" aria-hidden="true">download</span>
    {sheet.busy ? 'Preparing…' : label}
  </button>
  {#if !compact}
    <p class="omr-sheet__hint">
      Print, fill out by hand, then scan or photograph it to enter results.
    </p>
  {/if}
  {#if sheet.error}
    <p class="omr-sheet__error" role="alert">Could not generate the sheet: {sheet.error}</p>
  {/if}
</div>

<style>
  .omr-sheet {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-start;
  }

  .omr-sheet__hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .omr-sheet__error {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-danger);
  }
</style>
