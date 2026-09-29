<script lang="ts" generics="T extends string">
  /**
   * An intake question answered by picking one large card (e.g. "I'm a
   * patient" / "I'm a healthcare professional"). Exposed as a radio group so
   * the selected card is announced to assistive tech.
   */
  interface Option {
    value: T;
    title: string;
    description?: string;
  }

  interface Props {
    question: string;
    options: Option[];
    value: T | null;
    onSelect: (value: T) => void;
  }

  let { question, options, value, onSelect }: Props = $props();
  const headingId = $props.id();
</script>

<div class="prompt">
  <h2 id={headingId} class="prompt__question">{question}</h2>
  <div class="prompt__choices" role="radiogroup" aria-labelledby={headingId}>
    {#each options as opt (opt.value)}
      <button
        type="button"
        role="radio"
        aria-checked={value === opt.value}
        class="choice"
        class:choice--selected={value === opt.value}
        onclick={() => onSelect(opt.value)}
      >
        <span class="choice__title">{opt.title}</span>
        {#if opt.description}
          <span class="choice__desc">{opt.description}</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .prompt {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-6);
    margin-bottom: var(--space-6);
  }

  .prompt__question {
    font-size: 1.15rem;
    margin-bottom: var(--space-4);
  }

  .prompt__choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .choice {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-5);
    text-align: left;
    background: var(--color-bg);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, transform 0.12s, box-shadow 0.12s;
  }

  .choice:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-tint-ghost);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .choice--selected {
    border-color: var(--color-primary);
    background: var(--color-primary-tint-ghost);
  }

  .choice__title {
    font-weight: 600;
    color: var(--color-primary);
    font-size: 1rem;
  }

  .choice__desc {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  @media (max-width: 560px) {
    .prompt__choices {
      grid-template-columns: 1fr;
    }
  }
</style>
