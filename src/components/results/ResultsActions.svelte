<script lang="ts">
  /**
   * Footer of every results view: "Return to Home" / "Redo Assessment", plus
   * the PDF error (if the last download failed). "Redo" clears the session so
   * the restarted assessment begins a fresh encounter (see lib/session-clear).
   */
  interface Props {
    redoHref: string;
    error: string | null;
  }

  let { redoHref, error }: Props = $props();
</script>

<div class="actions">
  <a href="/" class="btn btn--secondary">Return to Home</a>
  <a href={redoHref} data-clear-session class="btn btn--primary">Redo Assessment</a>
</div>
{#if error}
  <p class="pdf-error" role="alert">PDF download failed: {error}</p>
{/if}

<style>
  .actions {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .pdf-error {
    color: var(--color-danger);
    font-size: 0.9rem;
    margin: var(--space-3) 0 0 0;
    text-align: center;
  }
</style>
