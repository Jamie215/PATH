<script lang="ts">
  /**
   * Page → assessment mapping for a scanned packet: each page's title strip
   * beside a picker pre-set to its best-fit test. A test can only take one
   * page, so duplicates must be resolved before review can start.
   */
  import Modal from '../Modal.svelte';
  import { ACUTE_CHILDREN } from '../../assessments/pain-classification/config';
  import type { ScanPage } from './upload-flow.svelte';

  interface Props {
    pages: ScanPage[];
    onConfirm: (choices: string[]) => void;
    onClose: () => void;
  }

  let { pages, onConfirm, onClose }: Props = $props();

  // The reviewer's pick per page (template id, or '' to skip).
  // svelte-ignore state_referenced_locally
  let choices = $state(pages.map((p) => p.suggestedId));

  const duplicateIds = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const id of choices) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    return new Set([...counts].filter(([, n]) => n > 1).map(([id]) => id));
  });
  const mappedCount = $derived(choices.filter(Boolean).length);
</script>

<Modal
  title="Which test is each page?"
  subtitle={'We matched each scanned page to an assessment — confirm or change it, then review the answers. Set a page to "Skip" to leave it out.'}
  {onClose}
>
  <ul class="mapping">
    {#each pages as p, i (p.index)}
      {@const duplicated = !!choices[i] && duplicateIds.has(choices[i])}
      <li class="mapping__row" class:mapping__row--dup={duplicated}>
        <img
          class="mapping__thumb"
          class:mapping__thumb--wide={duplicated}
          src={duplicated ? p.thumbWide : p.thumb}
          alt={duplicated
            ? `Title, name and date of scanned page ${p.index + 1}`
            : `Title of scanned page ${p.index + 1}`}
        />
        <div class="mapping__pick">
          <label class="mapping__label" for={`map-${p.index}`}>Page {p.index + 1}</label>
          <select
            id={`map-${p.index}`}
            class="mapping__select"
            class:mapping__select--dup={duplicated}
            bind:value={choices[i]}
            aria-invalid={duplicated}
          >
            {#each ACUTE_CHILDREN as c (c.slug)}
              <option value={c.omrTemplate?.id ?? ''}>{c.shortName}</option>
            {/each}
            <option value="">Skip this page</option>
          </select>
          {#if duplicated}
            <span class="mapping__note mapping__note--dup">
              Same test as another page — pick different tests or skip one.
            </span>
          {:else if !p.route.best}
            <span class="mapping__note">Couldn't auto-detect — please pick.</span>
          {/if}
        </div>
      </li>
    {/each}
  </ul>

  {#snippet footer()}
    {#if duplicateIds.size > 0}
      <p class="mapping__footer-note" role="alert">
        Two pages are set to the same test — resolve the highlighted ones to continue.
      </p>
    {/if}
    <button type="button" class="btn btn--secondary" onclick={onClose}>Cancel</button>
    <button
      type="button"
      class="btn btn--primary"
      onclick={() => onConfirm(choices)}
      disabled={duplicateIds.size > 0 || mappedCount === 0}
    >
      Review {mappedCount} test{mappedCount === 1 ? '' : 's'}
    </button>
  {/snippet}
</Modal>

<style>
  /* Page-mapping step: one row per scanned page — a thumbnail beside an
     assessment picker the reviewer confirms before the review queue starts. */
  .mapping {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .mapping__row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  /* Title-band crop: a wide, short banner. Left-anchored so the assessment name
     stays visible if the strip is scaled down. */
  .mapping__thumb {
    width: 100%;
    height: auto;
    max-height: 70px;
    object-fit: contain;
    object-position: left center;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm, 4px);
    background: var(--color-bg);
  }

  /* Conflicted rows show a taller crop (title through the name/date line), so
     give it more height and anchor it to the top. */
  .mapping__thumb--wide {
    max-height: 220px;
    object-position: left top;
  }

  @media (max-width: 620px) {
    .mapping {
      grid-template-columns: 1fr;
    }
  }

  .mapping__pick {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .mapping__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .mapping__select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    background: var(--color-bg);
    color: var(--color-text);
    max-width: 20rem;
  }
  .mapping__select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  /* A page sharing its assessment with another: flag the whole card and its
     picker so the reviewer can see exactly which ones collide. */
  .mapping__row--dup {
    border-color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 6%, transparent);
  }

  .mapping__select--dup {
    border-color: var(--color-danger);
  }
  .mapping__select--dup:focus {
    border-color: var(--color-danger);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-danger) 25%, transparent);
  }

  .mapping__note {
    font-size: 0.8rem;
    color: var(--color-warning);
  }

  .mapping__note--dup {
    color: var(--color-danger);
    font-weight: 600;
  }
  /* Push the blocking note to the left, buttons stay right. */
  .mapping__footer-note {
    margin: 0 auto 0 0;
    font-size: 0.85rem;
    color: var(--color-danger);
  }
</style>
