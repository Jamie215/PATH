<script lang="ts">
  /**
   * Acute pain-classification collection page.
   *
   * One card per child assessment, laid out in three columns: the assessment
   * name, inline manual-entry inputs, and a "Fill Out Questionnaire" button
   * that opens the child's survey in a modal. Each card also has an optional
   * comment box; completing the questionnaire carries its comment over here.
   *
   * A child is "complete" once all its numeric fields hold finite values,
   * whether typed directly or populated by a finished questionnaire.
   * "Calculate Results" unlocks once every child is complete.
   *
   * Guards: if no role is stored, redirects back to the intake.
   */
  import { onMount } from 'svelte';
  import { get as storeGet, set as storeSet, remove as storeRemove } from '../lib/storage';
  import MSISurvey from './MSISurvey.svelte';
  import BriefSLANSSSurvey from './BriefSLANSSSurvey.svelte';
  import FreBAQSurvey from './FreBAQSurvey.svelte';
  import PHQ4Survey from './PHQ4Survey.svelte';
  import {
    ACUTE_CHILDREN,
    KEYS,
    type Role,
    type ChildAssessment,
  } from '../assessments/pain-classification/config';

  let loaded = $state(false);
  let role = $state<Role | null>(null);

  // Per-child working state: numeric field values + an optional comment.
  let values = $state<Record<string, Record<string, number | undefined>>>({});
  let comments = $state<Record<string, string>>({});
  // The child whose questionnaire is currently open in the modal, if any.
  let modalChild = $state<ChildAssessment | null>(null);
  // Completion fraction (0–1) of the open questionnaire, bound from the
  // embedded survey so the modal header can render a fixed progress bar.
  let modalProgress = $state(0);

  onMount(() => {
    role = storeGet<Role>(KEYS.role);
    if (!role) {
      window.location.replace('/pain-classification/');
      return;
    }
    // Seed working state from anything already saved.
    for (const child of ACUTE_CHILDREN) {
      const savedValues = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
      if (savedValues) values[child.slug] = { ...savedValues };
      const savedComment = storeGet<string>(KEYS.commentPrefix + child.slug);
      if (savedComment) comments[child.slug] = savedComment;
    }
    loaded = true;
  });

  function childComplete(child: ChildAssessment): boolean {
    const v = values[child.slug];
    return !!v && child.manualFields.every((f) => typeof v[f.key] === 'number' && Number.isFinite(v[f.key]));
  }

  const doneCount = $derived(ACUTE_CHILDREN.filter((c) => childComplete(c)).length);
  const allDone = $derived(doneCount === ACUTE_CHILDREN.length);

  /** Persist a child's values to storage, keeping only finite numbers. */
  function persistValues(slug: string): void {
    const v = values[slug] ?? {};
    const clean: Record<string, number> = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'number' && Number.isFinite(val)) clean[k] = val;
    }
    if (Object.keys(clean).length > 0) storeSet(KEYS.manualPrefix + slug, clean);
    else storeRemove(KEYS.manualPrefix + slug);
  }

  function setField(slug: string, key: string, raw: number): void {
    const value = Number.isFinite(raw) ? raw : undefined;
    values = { ...values, [slug]: { ...(values[slug] ?? {}), [key]: value } };
    persistValues(slug);
  }

  function setComment(slug: string, text: string): void {
    comments = { ...comments, [slug]: text };
    const trimmed = text.trim();
    if (trimmed) storeSet(KEYS.commentPrefix + slug, trimmed);
    else storeRemove(KEYS.commentPrefix + slug);
  }

  function openQuestionnaire(child: ChildAssessment): void {
    // Role-gated children (MSI) read their role from storage on mount, so it
    // must be set before the survey renders — otherwise the survey redirects.
    if (child.roleKey && role) storeSet(child.roleKey, role);
    modalProgress = 0;
    modalChild = child;
  }

  function closeQuestionnaire(): void {
    modalChild = null;
  }

  /**
   * Called by the embedded survey after it scores and persists its result.
   * Pull the computed field values into the inline inputs, and carry any
   * comment typed in the questionnaire over to the card's comment box.
   */
  function finishQuestionnaire(child: ChildAssessment): void {
    const extracted = child.fromResult(storeGet(child.resultKey));
    if (extracted) {
      values = { ...values, [child.slug]: { ...extracted } };
      persistValues(child.slug);
    }
    const response = storeGet<Record<string, unknown>>(child.slug + ':response');
    const comment = typeof response?.other_comments === 'string' ? response.other_comments : '';
    if (comment) setComment(child.slug, comment);
    modalChild = null;
  }

  function onWindowKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && modalChild) closeQuestionnaire();
  }

  function calculate(): void {
    if (!allDone) return;
    window.location.href = '/pain-classification/results/';
  }
</script>

<svelte:window onkeydown={onWindowKey} />

{#if loaded}
  <section class="collect">
    <a class="collect__back" href="/pain-classification/">&larr; Go back</a>
    <h1 class="collect__heading">Acute Pain Classification</h1>
    <p class="collect__lede">
      Provide a result for each of the four assessments below — either enter a
      known result manually, or fill out the questionnaire. When all four are
      complete, calculate the composite classification.
    </p>

    <ul class="cards">
      {#each ACUTE_CHILDREN as child (child.slug)}
        <li class="assessment">
          <div class="card" class:card--done={childComplete(child)}>
            <header class="card__header">
              <div class="card__heading">
                <h2 class="card__title">{child.shortName}</h2>
                <p class="card__subtitle">{child.title}</p>
              </div>
              <div class="card__actions">
                <button type="button" class="btn btn--success card__btn" onclick={() => openQuestionnaire(child)}>
                  Fill Out Questionnaire
                </button>
              </div>
            </header>

            <div class="card__body">
            <div class="card__fields">
              {#each child.manualFields as f (f.key)}
                <label class="field">
                  <span class="field__label">
                    {f.label} <span class="field__range">({f.min}–{f.max})</span>
                  </span>
                  <input
                    class="field__input"
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step ?? 1}
                    value={values[child.slug]?.[f.key] ?? ''}
                    oninput={(e) => setField(child.slug, f.key, (e.currentTarget as HTMLInputElement).valueAsNumber)}
                  />
                </label>
              {/each}

              <label class="field field--comment">
                <span class="field__label">Comments (optional)</span>
                <textarea
                  class="field__textarea"
                  rows="2"
                  placeholder="Any notes about this assessment…"
                  value={comments[child.slug] ?? ''}
                  oninput={(e) => setComment(child.slug, (e.currentTarget as HTMLTextAreaElement).value)}
                ></textarea>
              </label>
            </div>
            </div>
          </div>
        </li>
      {/each}
    </ul>

    <div class="collect__footer">
      {#if !allDone}
        <p class="collect__hint">
          {ACUTE_CHILDREN.length - doneCount} of {ACUTE_CHILDREN.length} assessments still need a result.
        </p>
      {/if}
      <button type="button" class="btn btn--primary collect__calc" disabled={!allDone} onclick={calculate}>
        Calculate Results
      </button>
    </div>
  </section>

  {#if modalChild}
    {@const child = modalChild}
    <div
      class="modal-overlay"
      role="presentation"
      onclick={(e) => { if (e.target === e.currentTarget) closeQuestionnaire(); }}
    >
      <div class="modal" role="dialog" aria-modal="true" aria-label={`${child.shortName} questionnaire`}>
        <header class="modal__head">
          <div class="modal__head-row">
            <div>
              <h2 class="modal__title">{child.shortName}</h2>
              <p class="modal__subtitle">{child.title}</p>
            </div>
            <button type="button" class="modal__close" aria-label="Close questionnaire" onclick={closeQuestionnaire}>
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
          <div class="modal__progress" aria-hidden="true">
            <div class="modal__progress-bar" style:width={`${Math.round(modalProgress * 100)}%`}></div>
          </div>
        </header>
        <div class="modal__body">
          {#if child.slug === 'msi'}
            <MSISurvey onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {:else if child.slug === 'briefslanss'}
            <BriefSLANSSSurvey onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {:else if child.slug === 'frebaq'}
            <FreBAQSurvey onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {:else if child.slug === 'phq4'}
            <PHQ4Survey onComplete={() => finishQuestionnaire(child)} submitLabel="Done" showProgress={false} bind:progress={modalProgress} />
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .collect__back {
    display: inline-block;
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
    border-bottom: none;
  }

  .collect__heading {
    margin-bottom: var(--space-3);
  }

  .collect__lede {
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
  }

  .cards {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-7) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .card {
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
    overflow: hidden; /* clip the header background to the rounded corners */
  }

  .card--done {
    border-color: var(--color-success);
  }

  /* Header band: assessment heading on the left, action button(s) on the
     right. White background, separated from the body by a bottom border. */
  .card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }

  .card--done .card__header {
    border-bottom-color: var(--color-success);
  }

  .card__heading {
    min-width: 0;
  }

  .card__title {
    font-size: 1.1rem;
    margin: 0;
  }

  .card__subtitle {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin: var(--space-1) 0 0 0;
  }

  /* Action button group — column so a second (e.g. "Upload image") button
     stacks neatly beneath the first at matching width. */
  .card__actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .card__btn {
    padding: var(--space-2) var(--space-4);
    font-size: 0.85rem;
  }

  .card__body {
    padding: var(--space-5);
  }

  .card__fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field--comment {
    width: 100%;
  }

  .field__label {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .field__range {
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .field__input {
    width: 8rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .field__textarea {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.95rem;
    resize: vertical;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .field__input:focus,
  .field__textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  .btn--success {
    background: var(--color-success);
    color: #fff;
    white-space: nowrap;
  }
  .btn--success:hover {
    filter: brightness(0.93);
  }

  @media (max-width: 640px) {
    .card__header {
      flex-direction: column;
      align-items: stretch;
    }
  }

  .collect__footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-3);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-6);
  }

  .collect__hint {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin: 0;
  }

  .collect__calc {
    padding: var(--space-3) var(--space-7);
    font-size: 1rem;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: var(--space-6) var(--space-4);
    background: rgba(0, 0, 0, 0.5);
    overflow-y: auto;
  }

  .modal {
    width: 100%;
    max-width: 720px;
    background: var(--color-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 2 * var(--space-6));
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

  /* Fixed progress track: lives in the sticky header, so its background
     stays put while the questionnaire body scrolls beneath it. */
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

  .modal__body {
    padding: var(--space-5);
    overflow-y: auto;
  }
</style>
