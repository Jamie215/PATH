<script lang="ts">
  /**
   * Acute pain-classification collection page (professional view).
   *
   * One card per child assessment. Each offers "Take test" — the child's
   * survey in a modal, becoming "Edit the response" (pre-filled) once
   * answered — a "Download test" answer sheet, inline manual-entry fields, and
   * a comment box. A whole completed-tests upload is handled above the cards
   * by the upload flow (./upload-flow.svelte.ts).
   *
   * A child is "complete" once all its numeric fields hold finite values,
   * whether typed directly or filled in by a questionnaire/upload. "See
   * results" unlocks once every child is complete.
   */
  import { onMount } from 'svelte';
  import { get as storeGet, set as storeSet, remove as storeRemove } from '../../lib/storage';
  import { sanitizeBothersomeArea } from '../../assessments/frebaq/area';
  import { ACUTE_CHILDREN, KEYS, type ChildAssessment } from '../../assessments/pain-classification/config';
  import BackLink from '../BackLink.svelte';
  import Modal from '../Modal.svelte';
  import ChildCard from './ChildCard.svelte';
  import ChildSurvey from './ChildSurvey.svelte';
  import UploadDialog from './UploadDialog.svelte';
  import PageMappingDialog from './PageMappingDialog.svelte';
  import OverwriteDialog from './OverwriteDialog.svelte';
  import ReviewDialog from './ReviewDialog.svelte';
  import { UploadFlow } from './upload-flow.svelte';

  // Per-child working state: numeric field values, comment, and (FreBAQ) area.
  let values = $state<Record<string, Record<string, number | undefined>>>({});
  let comments = $state<Record<string, string>>({});
  let areas = $state<Record<string, string>>({});
  // Per-question answers stored for each child (from a questionnaire or an
  // upload) — drives "Edit the response" and pre-fills the survey.
  let answers = $state<Record<string, Record<string, number>>>({});

  // The child whose questionnaire is open in the modal, if any.
  let modalChild = $state<ChildAssessment | null>(null);
  let modalProgress = $state(0);

  const upload = new UploadFlow({
    area: (slug) => areas[slug],
    comment: (slug) => comments[slug],
    isComplete: (child) => childComplete(child),
    onConfirmed: (child) => absorbResult(child),
  });

  const responseKey = (slug: string) => `${slug}:response`;

  /** Numeric per-question answers from a child's stored response. */
  function readAnswers(slug: string): Record<string, number> {
    const r = storeGet<Record<string, unknown>>(responseKey(slug)) ?? {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(r)) if (typeof v === 'number') out[k] = v;
    return out;
  }

  onMount(() => {
    for (const child of ACUTE_CHILDREN) {
      const saved = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
      if (saved) values[child.slug] = { ...saved };
      const comment = storeGet<string>(KEYS.commentPrefix + child.slug);
      if (comment) comments[child.slug] = comment;
      const response = storeGet<Record<string, unknown>>(responseKey(child.slug));
      if (typeof response?.bothersome_area === 'string') areas[child.slug] = response.bothersome_area;
      answers[child.slug] = readAnswers(child.slug);
    }
  });

  function childComplete(child: ChildAssessment): boolean {
    const v = values[child.slug];
    return !!v && child.manualFields.every((f) => Number.isFinite(v[f.key]));
  }

  const doneCount = $derived(ACUTE_CHILDREN.filter(childComplete).length);
  const allDone = $derived(doneCount === ACUTE_CHILDREN.length);

  /** Persist a child's values to storage, keeping only finite numbers. */
  function persistValues(slug: string): void {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(values[slug] ?? {})) {
      if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v;
    }
    if (Object.keys(clean).length > 0) storeSet(KEYS.manualPrefix + slug, clean);
    else storeRemove(KEYS.manualPrefix + slug);
  }

  function setField(child: ChildAssessment, key: string, raw: number): void {
    const value = Number.isFinite(raw) ? raw : undefined;
    values[child.slug] = { ...(values[child.slug] ?? {}), [key]: value };
    persistValues(child.slug);
    // A hand-edited score no longer matches the questionnaire's scored result;
    // drop it so the composite report can't chart stale values from it.
    const stored = storeGet(child.resultKey);
    if (stored !== null && child.fromResult(stored)?.[key] !== value) storeRemove(child.resultKey);
  }

  function setComment(slug: string, text: string): void {
    comments[slug] = text;
    const trimmed = text.trim();
    if (trimmed) storeSet(KEYS.commentPrefix + slug, trimmed);
    else storeRemove(KEYS.commentPrefix + slug);
  }

  /** The area typed on the card lives on the child's stored response — where a
   *  questionnaire or upload writes it — so it pre-fills the survey too. */
  function setArea(slug: string, text: string): void {
    areas[slug] = text;
    const trimmed = sanitizeBothersomeArea(text);
    const response = storeGet<Record<string, unknown>>(responseKey(slug)) ?? {};
    if (trimmed) response.bothersome_area = trimmed;
    else delete response.bothersome_area;
    if (Object.keys(response).length > 0) storeSet(responseKey(slug), response);
    else storeRemove(responseKey(slug));
  }

  /**
   * A child's survey (questionnaire or upload review) has scored and stored
   * its result: pull the scores into the card's fields and carry over the
   * comment and area.
   */
  function absorbResult(child: ChildAssessment): void {
    const extracted = child.fromResult(storeGet(child.resultKey));
    if (extracted) {
      values[child.slug] = { ...extracted };
      persistValues(child.slug);
    }
    const response = storeGet<Record<string, unknown>>(responseKey(child.slug));
    if (typeof response?.other_comments === 'string' && response.other_comments) {
      setComment(child.slug, response.other_comments);
    }
    if (typeof response?.bothersome_area === 'string' && response.bothersome_area) {
      areas[child.slug] = response.bothersome_area;
    }
    answers[child.slug] = readAnswers(child.slug);
  }

  function openQuestionnaire(child: ChildAssessment): void {
    modalProgress = 0;
    modalChild = child;
  }

  function finishQuestionnaire(child: ChildAssessment): void {
    absorbResult(child);
    modalChild = null;
  }
</script>

<section class="collect">
  <BackLink href="/pain-classification/" />
  <h1 class="collect__heading">Pain Classification</h1>
  <p class="collect__lede">
    Provide a result for each of the {ACUTE_CHILDREN.length} assessments below — either enter
    known results, take the test directly, or upload completed tests.
  </p>

  <div class="bulk">
    <div class="bulk__text">
      <span class="material-symbols-outlined bulk__icon" aria-hidden="true">upload_file</span>
      <div>
        <p class="bulk__title">Have completed tests from the patient?</p>
        <p class="bulk__desc">Upload completed test(s), as a PDF or photos.</p>
      </div>
    </div>
    <button type="button" class="btn btn--primary bulk__btn" onclick={upload.openUpload}>
      <span class="material-symbols-outlined" aria-hidden="true">upload</span>
      Upload completed tests
    </button>
  </div>

  <ul class="cards">
    {#each ACUTE_CHILDREN as child, i (child.slug)}
      <li>
        <ChildCard
          {child}
          number={i + 1}
          complete={childComplete(child)}
          hasResponse={Object.keys(answers[child.slug] ?? {}).length > 0}
          values={values[child.slug] ?? {}}
          comment={comments[child.slug] ?? ''}
          area={areas[child.slug] ?? ''}
          onTakeTest={() => openQuestionnaire(child)}
          onField={(key, v) => setField(child, key, v)}
          onComment={(text) => setComment(child.slug, text)}
          onArea={(text) => setArea(child.slug, text)}
        />
      </li>
    {/each}
  </ul>

  <div class="collect__footer">
    {#if !allDone}
      <p class="collect__hint">
        {ACUTE_CHILDREN.length - doneCount} of {ACUTE_CHILDREN.length} assessments still need a result.
      </p>
    {/if}
    <button
      type="button"
      class="btn btn--next collect__calc"
      disabled={!allDone}
      onclick={() => (window.location.href = '/pain-classification/results/')}
    >
      See results
    </button>
  </div>
</section>

{#if modalChild}
  {@const child = modalChild}
  <Modal
    title={child.shortName}
    subtitle={child.description}
    closeLabel="Close questionnaire"
    progress={modalProgress}
    onClose={() => (modalChild = null)}
  >
    <ChildSurvey
      slug={child.slug}
      initialAnswers={answers[child.slug]}
      initialArea={areas[child.slug]}
      initialComments={comments[child.slug]}
      onComplete={() => finishQuestionnaire(child)}
      submitLabel="Done"
      showProgress={false}
      bind:progress={modalProgress}
    />
  </Modal>
{/if}

{#if upload.uploadOpen}
  <UploadDialog flow={upload} />
{/if}

{#if upload.scanPages.length > 0}
  <PageMappingDialog pages={upload.scanPages} onConfirm={upload.confirmMapping} onClose={upload.closeMapping} />
{/if}

{#if upload.overwriteList.length > 0}
  <OverwriteDialog
    children={upload.overwriteList}
    onConfirm={upload.confirmOverwrite}
    onCancel={upload.cancelOverwrite}
  />
{/if}

{#if upload.review}
  <ReviewDialog flow={upload} />
{/if}

<style>
  .collect__heading {
    margin-bottom: var(--space-3);
  }

  .collect__lede {
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
  }

  /* Bulk "upload completed tests" callout: sits above the per-test cards as the
     fast path when a patient shares one filled PDF. Tinted so it reads as a
     distinct shortcut, not another assessment card. */
  .bulk {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    padding: var(--space-4) var(--space-5);
    background: var(--color-primary-tint-ghost);
    border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
    border-radius: var(--radius-lg);
  }

  .bulk__text {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-width: 0;
  }

  .bulk__icon {
    flex-shrink: 0;
    color: var(--color-primary);
    font-size: 1.5rem;
  }

  .bulk__title {
    margin: 0;
    font-weight: 600;
    font-size: 0.98rem;
  }

  .bulk__desc {
    margin: var(--space-1) 0 0 0;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-text-muted);
  }

  .bulk__btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    font-size: 0.9rem;
    white-space: nowrap;
  }
  .bulk__btn .material-symbols-outlined {
    font-size: 1.1rem;
  }

  @media (max-width: 640px) {
    .bulk {
      flex-direction: column;
      align-items: stretch;
    }
    .bulk__btn {
      justify-content: center;
    }
  }

  .cards {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-7) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
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
</style>
