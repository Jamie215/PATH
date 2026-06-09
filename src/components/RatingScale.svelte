<script lang="ts">
  /**
   * Horizontal segmented rating scale. Reusable building block for any
   * assessment in the hub: pass options + selected value, get back a
   * change event.
   *
   * Keyboard accessible: arrow keys move selection, Enter/Space activates.
   */

  interface Option {
    readonly value: number;
    readonly label: string;
  }

  interface Props {
    label: string;
    options: ReadonlyArray<Option>;
    value: number | null;
    name: string;
    onChange: (value: number) => void;
  }

  let { label, options, value, name, onChange }: Props = $props();

  function handleKey(event: KeyboardEvent, currentValue: number): void {
    const idx = options.findIndex((o) => o.value === currentValue);
    if (idx === -1) return;
    let next = idx;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = Math.min(options.length - 1, idx + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = Math.max(0, idx - 1);
    } else {
      return;
    }
    event.preventDefault();
    onChange(options[next].value);
  }
</script>

<div class="rating" role="radiogroup" aria-label={label}>
  {#each options as opt (opt.value)}
    {@const selected = value === opt.value}
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabindex={selected || (value === null && opt === options[0]) ? 0 : -1}
      class="rating__option"
      class:rating__option--selected={selected}
      data-name={name}
      onclick={() => onChange(opt.value)}
      onkeydown={(e) => handleKey(e, opt.value)}
    >
      {opt.label}
    </button>
  {/each}
</div>

<style>
  .rating {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .rating__option {
    flex: 1 1 auto;
    min-width: 0;
    padding: var(--space-3) var(--space-3);
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    font-weight: 500;
    text-align: center;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
    cursor: pointer;
  }

  .rating__option:hover {
    background: var(--color-primary-tint-ghost);
    border-color: var(--color-primary-tint);
  }

  .rating__option:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .rating__option--selected {
    background: var(--color-primary);
    color: #ffffff;
    border-color: var(--color-primary);
  }

  .rating__option--selected:hover {
    background: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
  }
</style>
