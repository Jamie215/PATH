<script lang="ts">
  /**
   * One numbered survey question: number badge, title, optional description,
   * the "scan unclear" flag, and the answer control(s) as children.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    /** Element id — the survey scrolls to it when the question is unanswered. */
    id: string;
    number: number;
    title: string;
    description?: string;
    /** The sheet read flagged this question for review. */
    flagged?: boolean;
    children: Snippet;
  }

  let { id, number, title, description, flagged = false, children }: Props = $props();
</script>

<li class="question" class:question--flagged={flagged} {id}>
  <div class="question__head">
    <span class="question__num" class:question__num--flagged={flagged}>{number}</span>
    <div class="question__body">
      <h2 class="question__title">{title}</h2>
      {#if description}
        <p class="question__desc">{description}</p>
      {/if}
      {#if flagged}
        <span class="question__flag">
          <span class="material-symbols-outlined" aria-hidden="true">error</span>
          Scan unclear here — please confirm from your sheet
        </span>
      {/if}
    </div>
  </div>
  {@render children()}
</li>

<style>
  .question {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-5);
  }

  .question--flagged {
    background: var(--color-warning-tint);
    box-shadow: inset 3px 0 0 var(--color-warning);
    border-radius: var(--radius-md);
    padding: var(--space-4) var(--space-4) var(--space-4) var(--space-5);
    margin: 0 calc(-1 * var(--space-4));
    border-top-color: transparent;
  }

  .question__head {
    display: flex;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .question__num {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: var(--color-primary-tint-ghost);
    color: var(--color-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .question__num--flagged {
    background: var(--color-warning);
    color: var(--color-bg);
  }

  .question__body {
    flex: 1;
    min-width: 0;
  }

  .question__title {
    font-size: 1.02rem;
    font-weight: 600;
    margin: 0 0 var(--space-1) 0;
    line-height: 1.4;
  }

  .question__desc {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin: 0;
  }

  .question__flag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-top: var(--space-2);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-warning);
  }

  .question__flag .material-symbols-outlined {
    font-size: 1rem;
  }
</style>
