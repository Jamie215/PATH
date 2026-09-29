<script lang="ts">
  /**
   * Generic single-group survey: one row per item, one mutually-exclusive
   * rating per row. Backs the Brief S-LANSS, FreBAQ, and PHQ-4 surveys (which
   * are structurally identical, unlike MSI's paired frequency/bothersomeness
   * layout), so each of those is a thin wrapper that supplies this component
   * its questions, options, scorer, and storage slug.
   *
   * An optional `areaField` renders a free-text "most bothersome area" input
   * above the questions (currently only FreBAQ); when absent that block and all
   * its area-* props are simply unused.
   *
   * When `onComplete` is supplied (the survey is embedded in a parent flow), it
   * is called after scoring instead of navigating to the standalone results
   * page. The scored result is persisted to sessionStorage either way.
   */
  import RatingScale from './RatingScale.svelte';
  import SurveyShell from './survey/SurveyShell.svelte';
  import QuestionItem from './survey/QuestionItem.svelte';
  import type { EmbeddedSurveyProps } from './survey/types';
  import { set as storeSet } from '../lib/storage';

  interface Question {
    symptom: string;
    /** Short symptom name shown as the question title. */
    symptomLabel: string;
    /** Optional clarifying text shown beneath the title. */
    description?: string;
  }

  interface Props extends EmbeddedSurveyProps {
    questions: readonly Question[];
    experienceOptions: readonly { value: number; label: string }[];
    intro: string;
    /** sessionStorage key prefix; the survey writes `${slug}:response`/`:result`. */
    slug: string;
    /** Standalone results page to navigate to when not embedded. */
    resultsUrl: string;
    /** Scores a built response record into the assessment's result object. */
    score: (response: Record<string, number | string>) => unknown;
    /** Enables the free-text "most bothersome area" field above the questions. */
    areaField?: { label: string; placeholder: string };
    /** Normalizes the area text before it is stored (e.g. FreBAQ's sanitizer). */
    sanitizeArea?: (text: string) => string;
    /** Fully normalizes a confirmed area (punctuation + leading "my"/"the"
     *  strip). Falls back to sanitizeArea when absent. */
    normalizeArea?: (text: string) => string;
    /** Rewrites a question label to reference the confirmed area (e.g. FreBAQ's
     *  "the area" → "my right knee"). */
    personalizeArea?: (label: string, area: string) => string;
  }

  let {
    questions,
    experienceOptions,
    intro,
    slug,
    resultsUrl,
    score,
    areaField,
    sanitizeArea,
    normalizeArea,
    personalizeArea,
    onComplete,
    onBack,
    backLabel,
    submitLabel = 'See results',
    submitIcon,
    showProgress = true,
    progress = $bindable(0),
    initialAnswers,
    initialArea,
    initialComments,
    review = false,
    requireArea,
    commentsDetected,
    areaCropUrl,
    areaCorrection,
    attentionKeys,
  }: Props = $props();

  const uid = $props.id();
  const areaId = `${uid}-area`;
  const questionId = (symptom: string) => `${uid}-q-${symptom}`;

  const normalize = (text: string): string =>
    normalizeArea ? normalizeArea(text) : sanitizeArea ? sanitizeArea(text) : text.trim();

  // Seed from the initial props once; afterwards the form owns its state.
  // svelte-ignore state_referenced_locally
  let answers = $state<Record<string, number>>({ ...(initialAnswers ?? {}) });
  // `area` is the live text in the input; `confirmedArea` is the value woven
  // into the questions — it only changes when the user presses "Confirm"
  // (or, in review, tracks the live text so scanned edits reflect immediately).
  // svelte-ignore state_referenced_locally
  let area = $state(initialArea ?? '');
  // svelte-ignore state_referenced_locally
  let confirmedArea = $state(initialArea ? normalize(initialArea) : '');
  // Whether the area input is expanded for (re-)entry. Fresh flow starts open
  // when nothing is confirmed yet; the user can reopen it via "Change area".
  let editingArea = $state(false);
  // svelte-ignore state_referenced_locally
  let comments = $state(initialComments ?? '');
  let submitAttempted = $state(false);

  // In review the questions personalize from the live text (there's no confirm
  // step); otherwise they follow the confirmed value.
  const activeArea = $derived(review ? area : confirmedArea);

  function confirmArea(): void {
    const normalized = normalize(area);
    if (!normalized) return; // don't confirm an empty area
    confirmedArea = normalized;
    area = normalized; // reflect the cleaned value back into the (now collapsed) input
    editingArea = false;
  }

  // Each symptom needs exactly one answer (no follow-ups).
  const missing = $derived(questions.filter((q) => answers[`${q.symptom}_exp`] === undefined));

  // With an area field, the rated items reference that area (e.g. FreBAQ's "the
  // area feels lopsided"), so keep the questions hidden until the user confirms
  // one. A review of an uploaded sheet is never gated: it arrives with answers
  // to confirm, and the area may have been left blank on the sheet.
  const questionsReady = $derived(!areaField || review || confirmedArea.trim().length > 0);

  // The area input is expanded when reviewing (its crop/hint UI), while
  // (re-)entering, or before anything is confirmed. Otherwise it collapses to a
  // one-line summary with a "Change area" button.
  const showAreaInput = $derived(review || editingArea || confirmedArea.trim().length === 0);

  // The bothersome-area field must be filled because the scanned region had
  // ink. Comments are only highlighted for attention, never required.
  const areaMissing = $derived(submitAttempted && !!requireArea && area.trim().length === 0);

  // Report progress up so an embedding parent (e.g. the modal header) can
  // render the bar itself.
  $effect(() => {
    progress = questions.length > 0 ? (questions.length - missing.length) / questions.length : 0;
  });

  function submit(): void {
    submitAttempted = true;
    if (missing.length > 0) {
      document
        .getElementById(questionId(missing[0].symptom))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (requireArea && !area.trim()) {
      document.getElementById(areaId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const response: Record<string, number | string> = { ...answers };
    if (areaField) {
      // Store the confirmed value in the fresh flow; in review the live text is
      // the source of truth (there's no confirm step).
      const cleanedArea = normalize(review ? area : confirmedArea);
      if (cleanedArea.length > 0) response.bothersome_area = cleanedArea;
    }
    if (comments.trim().length > 0) response.other_comments = comments.trim();

    storeSet(`${slug}:response`, response);
    storeSet(`${slug}:result`, score(response));
    if (onComplete) onComplete();
    else window.location.href = resultsUrl;
  }
</script>

<SurveyShell
  {intro}
  {progress}
  {showProgress}
  bind:comments
  {commentsDetected}
  showFooter={questionsReady}
  missingCount={missing.length}
  {submitAttempted}
  {submitLabel}
  {submitIcon}
  {onBack}
  {backLabel}
  onSubmit={submit}
>
  {#snippet header()}
    {#if areaField}
      {#if showAreaInput}
        <div class="area">
          <label for={areaId} class="area__label">
            {areaField.label}
            {#if requireArea}<span class="req" title="Written on the sheet — please confirm">*</span>{/if}
          </label>
          <div class="area__row">
            <input
              id={areaId}
              class="area__input"
              class:field--error={areaMissing}
              class:field--flagged={requireArea && !areaMissing}
              type="text"
              bind:value={area}
              placeholder={areaField.placeholder}
              onkeydown={(e) => { if (!review && e.key === 'Enter') { e.preventDefault(); confirmArea(); } }}
            />
            {#if !review}
              <button
                type="button"
                class="btn btn--primary area__confirm"
                onclick={confirmArea}
                disabled={area.trim().length === 0}
              >
                Confirm
              </button>
            {/if}
          </div>
          {#if areaCropUrl}
            <figure class="area__crop">
              <figcaption class="area__crop-label">From the scanned sheet</figcaption>
              <img class="area__crop-img" src={areaCropUrl} alt="Scanned handwriting for the most bothersome area" />
            </figure>
          {/if}
          {#if areaMissing}
            <p class="field__error">This was written on the scanned sheet — please enter it from the scan.</p>
          {:else if areaCorrection === 'unread'}
            <p class="field__hint">Correction marks made this hard to read automatically — please enter it from the scan above.</p>
          {:else if areaCorrection === 'cleaned'}
            <p class="field__hint">Possible correction marks were removed before reading — please verify against the scan.</p>
          {:else if requireArea}
            <p class="field__hint">From the scanned sheet — please verify against the scan.</p>
          {:else if !review}
            <p class="field__hint">The questions below will refer to “{area.trim() ? area.trim().toLowerCase() : '…'}”.</p>
          {/if}
        </div>
      {:else}
        <div class="area-summary">
          <span class="area-summary__text">
            Bothersome area: <strong>my {confirmedArea}</strong>
          </span>
          <button type="button" class="btn btn--secondary area-summary__change" onclick={() => (editingArea = true)}>
            Change area
          </button>
        </div>
      {/if}
    {/if}
  {/snippet}

  {#if !questionsReady}
    <p class="survey__gate">Enter your most bothersome area above and press “Confirm” to see the questions.</p>
  {:else}
    <ol class="survey-list">
      {#each questions as q, i (q.symptom)}
        {@const expKey = `${q.symptom}_exp`}
        {@const expValue = answers[expKey] ?? null}
        {@const title = personalizeArea ? personalizeArea(q.symptomLabel, activeArea) : q.symptomLabel}
        <QuestionItem
          id={questionId(q.symptom)}
          number={i + 1}
          {title}
          description={q.description}
          flagged={(attentionKeys?.includes(expKey) ?? false) && expValue === null}
        >
          <RatingScale
            label={`Experience of ${title}`}
            options={experienceOptions}
            value={expValue}
            onChange={(v) => (answers[expKey] = v)}
          />
          {#if submitAttempted && expValue === null}
            <p class="field__error">Please select an option.</p>
          {/if}
        </QuestionItem>
      {/each}
    </ol>
  {/if}
</SurveyShell>

<style>
  .survey__gate {
    color: var(--color-text-muted);
    font-size: 0.95rem;
    padding: var(--space-5);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-subtle);
    text-align: center;
  }

  .area {
    margin-bottom: var(--space-6);
  }

  .area__label {
    display: block;
    font-size: 0.95rem;
    font-weight: 500;
    margin-bottom: var(--space-2);
  }

  .area__row {
    display: flex;
    gap: var(--space-2);
    align-items: stretch;
  }

  .area__input {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.95rem;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .area__input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  .area__confirm {
    flex-shrink: 0;
    white-space: nowrap;
    padding: var(--space-2) var(--space-4);
    font-size: 0.9rem;
  }

  .area__confirm:disabled {
    cursor: not-allowed;
  }

  /* Collapsed summary shown once an area is confirmed: the region on the left,
     a "Change area" button on the right to reopen the input. */
  .area-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-primary-tint-ghost);
  }

  .area-summary__text {
    font-size: 0.95rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .area-summary__change {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-4);
    font-size: 0.85rem;
  }

  .area__crop {
    margin: var(--space-2) 0 0 0;
    padding: var(--space-2);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-subtle);
  }

  .area__crop-label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-1);
  }

  .area__crop-img {
    display: block;
    max-width: 100%;
    height: auto;
    image-rendering: crisp-edges;
  }

  .req {
    color: var(--color-danger);
    font-weight: 700;
    margin-left: 2px;
  }
</style>
