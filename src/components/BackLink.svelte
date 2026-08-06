<script lang="ts">
  /**
   * A muted "go back" control.
   *
   * By default it returns to the previous page or view in the browser history
   * (the same behaviour patients expect from a browser back button), falling
   * back to the hub when there is no in-app history to return to — e.g. the
   * page was opened directly or in a fresh tab.
   *
   * Pass `onBack` to override the navigation with a custom handler, e.g. the
   * pain-classification flow steps back through its in-page tests rather than
   * touching browser history.
   */
  let {
    label = 'Go back',
    onBack,
    fallback = '/',
  }: { label?: string; onBack?: () => void; fallback?: string } = $props();

  function handleClick(): void {
    if (onBack) {
      onBack();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = fallback;
    }
  }
</script>

<button type="button" class="back-link" onclick={handleClick}>
  <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
  {label}
</button>

<style>
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    /* Negative left margin cancels the button's own left padding so the icon
       lines up with the content's left edge; bottom margin separates it from
       whatever follows (e.g. an assessment heading). Neutralized by callers
       that place it in a flex row (see the surveys' .actions__back). */
    margin: 0 0 var(--space-4) calc(-1 * var(--space-3));
    background: none;
    border: none;
    padding: var(--space-2) var(--space-3);
    color: var(--color-text-muted);
    font-size: 0.95rem;
    font-family: inherit;
    cursor: pointer;
    border-radius: var(--radius-md);
  }
  .back-link:hover {
    color: var(--color-text);
    background: var(--color-primary-tint-ghost);
  }
  .back-link .material-symbols-outlined {
    font-size: 1.2rem;
  }
</style>
