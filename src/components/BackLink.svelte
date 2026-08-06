<script lang="ts">
  /**
   * A "go back" control, in one of two visual variants:
   *   - "link" (default): a muted text link, used at the top of a view.
   *   - "button": a solid button paired with a primary action (e.g. the
   *     pain-classification flow's "Previous test" beside "Next test").
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
    variant = 'link',
  }: {
    label?: string;
    onBack?: () => void;
    fallback?: string;
    variant?: 'link' | 'button';
  } = $props();

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

<button
  type="button"
  class="back-link"
  class:back-link--link={variant === 'link'}
  class:back-link--button={variant === 'button'}
  onclick={handleClick}
>
  <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
  {label}
</button>

<style>
  .back-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    border: none;
    background: none;
    font-family: inherit;
    cursor: pointer;
    border-radius: var(--radius-md);
  }

  /* Muted text-link variant (top-of-view navigation). */
  .back-link--link {
    /* Negative left margin cancels the button's own left padding so the icon
       lines up with the content's left edge; bottom margin separates it from
       whatever follows (e.g. an assessment heading). Neutralized by callers
       that place it in a flex row. */
    margin: 0 0 var(--space-4) calc(-1 * var(--space-3));
    padding: var(--space-2) var(--space-3);
    color: var(--color-text-muted);
    font-size: 0.95rem;
  }
  .back-link--link:hover {
    color: var(--color-text);
    background: var(--color-primary-tint-ghost);
  }
  .back-link--link .material-symbols-outlined {
    font-size: 1.2rem;
  }

  /* Solid button variant, paired with a primary action. Mirrors .btn--secondary
     at the primary button's size so it reads as a sibling of the Next button. */
  .back-link--button {
    gap: var(--space-2);
    padding: var(--space-3) var(--space-7);
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-primary);
    background: var(--color-primary-tint-ghost);
    border: 1px solid var(--color-primary-tint);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .back-link--button:hover {
    background: var(--color-primary-tint-soft);
  }
  .back-link--button .material-symbols-outlined {
    font-size: 1.1rem;
  }
</style>
