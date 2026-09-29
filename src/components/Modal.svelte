<script lang="ts">
  /**
   * Dialog shell shared by every modal: overlay, sticky header (title,
   * subtitle, close button, optional progress bar), scrolling body and an
   * optional sticky footer.
   *
   * Accessibility: focus moves into the dialog when it opens, Tab is kept
   * inside it, Escape and an overlay click close it, focus returns to the
   * element that opened it, and the page behind stops scrolling.
   */
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    title: string;
    subtitle?: string;
    /** Small line above the title (e.g. "Test 2 of 3"). */
    eyebrow?: string;
    /** Label for the close button. */
    closeLabel?: string;
    size?: 'default' | 'narrow' | 'wide';
    /** Completion fraction (0–1); renders a progress bar under the header. */
    progress?: number;
    onClose: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    title,
    subtitle,
    eyebrow,
    closeLabel = 'Close',
    size = 'default',
    progress,
    onClose,
    children,
    footer,
  }: Props = $props();

  const titleId = $props.id();
  let dialog: HTMLDivElement;

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

  onMount(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  });

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<div
  class="modal-overlay"
  role="presentation"
  onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
  <div
    bind:this={dialog}
    class="modal modal--{size}"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
    onkeydown={onKeydown}
  >
    <header class="modal__head">
      <div class="modal__head-row">
        <div>
          {#if eyebrow}<p class="modal__eyebrow">{eyebrow}</p>{/if}
          <h2 id={titleId} class="modal__title">{title}</h2>
          {#if subtitle}<p class="modal__subtitle">{subtitle}</p>{/if}
        </div>
        <button type="button" class="modal__close" aria-label={closeLabel} onclick={onClose}>
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </div>
      {#if progress !== undefined}
        <div class="modal__progress" aria-hidden="true">
          <div class="modal__progress-bar" style:width={`${Math.round(progress * 100)}%`}></div>
        </div>
      {/if}
    </header>
    <div class="modal__body">
      {@render children()}
    </div>
    {#if footer}
      <footer class="modal__footer">
        {@render footer()}
      </footer>
    {/if}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: var(--space-6) var(--space-4);
    background: rgb(0 0 0 / 0.5);
    overflow-y: auto;
  }

  .modal {
    width: 100%;
    max-width: 980px;
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 2 * var(--space-6));
  }

  .modal:focus {
    outline: none;
  }

  .modal--narrow {
    max-width: 440px;
  }

  /* The upload review gets far more room than the default modal, so the sheet
     beside the form is large enough to read each bubble against. */
  .modal--wide {
    max-width: min(1400px, 96vw);
    max-height: calc(100vh - 2 * var(--space-4));
  }

  .modal__head {
    padding: var(--space-5) var(--space-5) 0;
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    background: var(--color-bg);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .modal__head-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    padding-bottom: var(--space-4);
  }

  .modal__eyebrow {
    margin: 0 0 var(--space-1) 0;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--color-primary);
  }

  .modal__title {
    margin: 0;
    font-size: 1.2rem;
  }

  .modal__subtitle {
    margin: var(--space-1) 0 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }

  .modal__close {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .modal__close:hover {
    background: var(--color-primary-tint-ghost);
    color: var(--color-text);
  }

  /* Fixed progress track: lives in the sticky header, so it stays put while
     the body scrolls beneath it. */
  .modal__progress {
    height: 4px;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: -1px; /* sit flush over the header's bottom border */
  }

  .modal__progress-bar {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s ease-out;
  }

  .modal__body {
    padding: var(--space-5);
    overflow-y: auto;
  }

  .modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-top: 1px solid var(--color-border);
    position: sticky;
    bottom: 0;
    background: var(--color-bg);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  }
</style>
