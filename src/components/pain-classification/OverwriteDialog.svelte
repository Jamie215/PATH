<script lang="ts">
  /** Warns before an upload replaces results the user already recorded. */
  import Modal from '../Modal.svelte';
  import type { ChildAssessment } from '../../assessments/pain-classification/config';

  interface Props {
    children: ChildAssessment[];
    onConfirm: () => void;
    onCancel: () => void;
  }

  let { children: list, onConfirm, onCancel }: Props = $props();
  const one = $derived(list.length === 1);
</script>

<Modal
  title="Replace existing results?"
  subtitle={`This upload covers ${one ? 'a test' : 'tests'} that already ${one ? 'has' : 'have'} a result. ` +
    `Continuing will replace ${one ? 'it' : 'them'} as you confirm each in review — other results are untouched.`}
  size="narrow"
  onClose={onCancel}
>
  <p class="overwrite__lead">Already has a result:</p>
  <ul class="overwrite__list">
    {#each list as c (c.slug)}
      <li class="overwrite__item">
        <span class="material-symbols-outlined overwrite__icon" aria-hidden="true">warning</span>
        {c.shortName}
      </li>
    {/each}
  </ul>

  {#snippet footer()}
    <button type="button" class="btn btn--secondary" onclick={onCancel}>Cancel</button>
    <button type="button" class="btn btn--primary" onclick={onConfirm}>Continue &amp; replace</button>
  {/snippet}
</Modal>

<style>
  /* Overwrite confirmation: the list of assessments about to be replaced. */
  .overwrite__lead {
    margin: 0 0 var(--space-2) 0;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .overwrite__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .overwrite__item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: 0.95rem;
    border: 1px solid color-mix(in srgb, var(--color-warning) 40%, transparent);
    background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    border-radius: var(--radius-md);
  }

  .overwrite__icon {
    color: var(--color-warning);
    font-size: 1.2rem;
  }
</style>
