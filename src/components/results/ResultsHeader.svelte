<script lang="ts">
  /**
   * "Patient name / ID" field + "Download results" button shared by every
   * results view. State lives in the `PatientNameField` / `PdfDownload`
   * controllers (lib/results.svelte.ts); the caller supplies the download.
   */
  import type { PatientNameField, PdfDownload } from '../../lib/results.svelte';

  interface Props {
    name: PatientNameField;
    pdf: PdfDownload;
    onDownload: () => void;
    /** Show the committed name as a heading under the field. */
    showName?: boolean;
  }

  let { name, pdf, onDownload, showName = true }: Props = $props();
</script>

<section class="name-section" aria-labelledby="name-heading">
  <div class="name-row">
    <label id="name-heading" class="name-row__label" for="patient-name">Patient name / ID</label>
    <input
      id="patient-name"
      class="name-row__input"
      type="text"
      placeholder="Enter name"
      bind:value={name.input}
      onkeydown={name.handleKey}
      oninput={name.save}
    />
    <button type="button" class="btn btn--primary" onclick={onDownload} disabled={pdf.busy}>
      <span class="material-symbols-outlined" aria-hidden="true">download</span>
      {pdf.busy ? 'Downloading…' : 'Download results'}
    </button>
  </div>
  {#if showName && name.display}
    <h2 class="name-display">{name.display}</h2>
  {/if}
</section>

<style>
  .name-section {
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .name-row__label {
    font-weight: 600;
    color: var(--color-text);
  }

  .name-row__input {
    flex: 1;
    min-width: 200px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.95rem;
    color: var(--color-text);
    background: var(--color-bg);
  }

  .name-row__input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  .name-display {
    margin: var(--space-4) 0 0 0;
    color: var(--color-primary);
    font-size: 1.4rem;
  }
</style>
