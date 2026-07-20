<script lang="ts">
  /**
   * Acute pain-classification collection page.
   *
   * Shows one card per child assessment. Each child can be satisfied by:
   *   - "Fill Out Questionnaire": launches the child (writing assessment
   *     context so it returns here), or
   *   - Manual entry: type the child's result inline.
   *
   * A child counts as "have data" if a manual entry is saved OR the child's
   * scored result is in sessionStorage. "Calculate Results" unlocks once all
   * children have data.
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

  // Per-child working values for manual entry, plus which card is expanded.
  let manual = $state<Record<string, Record<string, number>>>({});
  let expanded = $state<string | null>(null);
  // The child whose questionnaire is currently open in the modal, if any.
  let modalChild = $state<ChildAssessment | null>(null);
  // Completion fraction (0–1) of the open questionnaire, bound from the
  // embedded survey so the modal header can render a fixed progress bar.
  let modalProgress = $state(0);
  // Bumped after a save/completion to recompute derived status from storage.
  let tick = $state(0);

  onMount(() => {
    role = storeGet<Role>(KEYS.role);
    if (!role) {
      window.location.replace('/pain-classification/');
      return;
    }
    // Seed manual working state from anything already saved.
    for (const child of ACUTE_CHILDREN) {
      const saved = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
      if (saved) manual[child.slug] = { ...saved };
    }
    loaded = true;
  });

  /** Resolved data for a child: manual entry wins, else its stored result. */
  function resolved(child: ChildAssessment): { values: Record<string, number>; source: 'manual' | 'questionnaire' } | null {
    tick; // establish reactive dependency
    const savedManual = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
    if (savedManual) return { values: savedManual, source: 'manual' };
    const fromResult = child.fromResult(storeGet(child.resultKey));
    if (fromResult) return { values: fromResult, source: 'questionnaire' };
    return null;
  }

  const statuses = $derived(
    (() => {
      tick;
      return ACUTE_CHILDREN.map((c) => ({ slug: c.slug, done: resolved(c) !== null }));
    })(),
  );
  const allDone = $derived(statuses.every((s) => s.done));

  function toggle(slug: string): void {
    expanded = expanded === slug ? null : slug;
  }

  function setManualField(slug: string, key: string, value: number): void {
    manual = { ...manual, [slug]: { ...(manual[slug] ?? {}), [key]: value } };
  }

  function manualComplete(child: ChildAssessment): boolean {
    const vals = manual[child.slug];
    return !!vals && child.manualFields.every((f) => typeof vals[f.key] === 'number' && Number.isFinite(vals[f.key]));
  }

  function saveManual(child: ChildAssessment): void {
    if (!manualComplete(child)) return;
    storeSet(KEYS.manualPrefix + child.slug, manual[child.slug]);
    expanded = null;
    tick += 1;
  }

  function clearData(child: ChildAssessment): void {
    storeRemove(KEYS.manualPrefix + child.slug);
    const next = { ...manual };
    delete next[child.slug];
    manual = next;
    tick += 1;
  }

  function openQuestionnaire(child: ChildAssessment): void {
    // Role-gated children (MSI) read their role from storage on mount, so it
    // must be set before the survey renders — otherwise the survey redirects.
    if (child.roleKey && role) storeSet(child.roleKey, role);
    expanded = null; // don't show the manual editor behind the modal
    modalProgress = 0;
    modalChild = child;
  }

  function closeQuestionnaire(): void {
    modalChild = null;
  }

  /**
   * Called by the embedded survey after it scores and persists its result.
   * A completed questionnaire supersedes any prior manual entry for the same
   * child, so we drop the manual override before re-reading status.
   */
  function finishQuestionnaire(child: ChildAssessment): void {
    storeRemove(KEYS.manualPrefix + child.slug);
    const next = { ...manual };
    delete next[child.slug];
    manual = next;
    modalChild = null;
    tick += 1;
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
    <a class="collect__back" href="/pain-classification/">&larr; Change pain type or role</a>
    <h1 class="collect__heading">Acute Pain Classification</h1>
    <p class="collect__lede">
      Provide a result for each of the four assessments below — either enter a
      known result manually, or fill out the questionnaire. When all four are
      complete, calculate the composite classification.
    </p>

    <ul class="cards">
      {#each ACUTE_CHILDREN as child (child.slug)}
        {@const data = (tick, resolved(child))}
        {@const isOpen = expanded === child.slug}
        <li class="card" class:card--done={data}>
          <div class="card__head">
            <div class="card__title-wrap">
              <h2 class="card__title">{child.shortName}</h2>
              <p class="card__subtitle">{child.title}</p>
            </div>
            <span class="card__status" class:card__status--done={data}>
              {#if data}
                <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
                {data.source === 'manual' ? 'Entered manually' : 'From questionnaire'}
              {:else}
                Not provided
              {/if}
            </span>
          </div>

          {#if data}
            <dl class="card__values">
              {#each child.manualFields as f (f.key)}
                <div class="card__value">
                  <dt>{f.label}</dt>
                  <dd>{data.values[f.key] ?? '—'}</dd>
                </div>
              {/each}
            </dl>
          {/if}

          <div class="card__actions">
            <button type="button" class="btn btn--secondary" onclick={() => openQuestionnaire(child)}>
              Fill Out Questionnaire
            </button>
            <button type="button" class="btn btn--ghost" onclick={() => toggle(child.slug)}>
              {isOpen ? 'Cancel' : data ? 'Edit manually' : 'Enter result manually'}
            </button>
            {#if data}
              <button type="button" class="btn btn--ghost card__clear" onclick={() => clearData(child)}>
                Clear
              </button>
            {/if}
          </div>

          {#if isOpen}
            <div class="manual">
              {#each child.manualFields as f (f.key)}
                <label class="manual__field">
                  <span class="manual__label">{f.label} ({f.min}–{f.max})</span>
                  <input
                    class="manual__input"
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step ?? 1}
                    value={manual[child.slug]?.[f.key] ?? ''}
                    oninput={(e) => setManualField(child.slug, f.key, (e.currentTarget as HTMLInputElement).valueAsNumber)}
                  />
                </label>
              {/each}
              <button
                type="button"
                class="btn btn--primary"
                disabled={!manualComplete(child)}
                onclick={() => saveManual(child)}
              >
                Save
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    <div class="collect__footer">
      {#if !allDone}
        <p class="collect__hint">
          {statuses.filter((s) => !s.done).length} of {ACUTE_CHILDREN.length} assessments still need a result.
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
    gap: var(--space-4);
  }

  .card {
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    background: var(--color-bg);
  }

  .card--done {
    border-color: var(--color-primary-tint);
    background: var(--color-primary-tint-ghost);
  }

  .card__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .card__title {
    font-size: 1.1rem;
    margin: 0;
  }

  .card__subtitle {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    margin: var(--space-1) 0 0 0;
  }

  .card__status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: 0.82rem;
    color: var(--color-text-subtle);
    white-space: nowrap;
  }

  .card__status--done {
    color: var(--color-primary);
    font-weight: 600;
  }

  .card__status .material-symbols-outlined {
    font-size: 18px;
  }

  .card__values {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    margin: var(--space-4) 0 0 0;
  }

  .card__value dt {
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }

  .card__value dd {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
  }

  .card__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-5);
  }

  .card__clear {
    margin-left: auto;
  }

  .manual {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-4);
    margin-top: var(--space-5);
    padding-top: var(--space-5);
    border-top: 1px solid var(--color-border);
  }

  .manual__field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .manual__label {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .manual__input {
    width: 8rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .manual__input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  .collect__footer {
    display: flex;
    flex-direction: column;
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

  .btn--ghost {
    background: transparent;
    color: var(--color-primary);
    border: 1px solid transparent;
  }
  .btn--ghost:hover {
    background: var(--color-primary-tint-ghost);
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
    font-size: 0.85rem;
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
