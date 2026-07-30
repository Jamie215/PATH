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
   */
  import RatingScale from './RatingScale.svelte';
  import { set as storeSet } from '../lib/storage';

  interface Question {
    symptom: string;
    /** Short symptom name shown as the question title. */
    symptomLabel: string;
    /** Optional clarifying text shown beneath the title. */
    description?: string;
  }

  /**
   * When `onComplete` is supplied (e.g. the survey is embedded in a modal
   * from a parent composite assessment), it is called after scoring instead
   * of navigating to the standalone results page. The scored result is still
   * persisted to sessionStorage either way, so `onComplete` can read it back.
   */
  let {
    // --- Assessment configuration (supplied by the wrapper) ---
    questions,
    experienceOptions,
    intro,
    /** sessionStorage key prefix; the survey writes `${slug}:response`/`:result`. */
    slug,
    /** Standalone results page to navigate to when not embedded. */
    resultsUrl,
    /** Scores a built response record into the assessment's result object. */
    score,
    /** Enables the free-text "most bothersome area" field above the questions. */
    areaField,
    /** Normalizes the area text before it is stored (e.g. FreBAQ's sanitizer). */
    sanitizeArea,
    // --- Runtime props (embedding parent / scan review) ---
    onComplete,
    submitLabel = 'See results',
    showProgress = true,
    progress = $bindable(0),
    initialAnswers,
    initialArea,
    initialComments,
    requireArea,
    requireComments,
    areaCropUrl,
    areaCorrection,
    attentionKeys,
  }: {
    questions: readonly Question[];
    experienceOptions: readonly { value: number; label: string }[];
    intro: string;
    slug: string;
    resultsUrl: string;
    score: (response: Record<string, number | string>) => unknown;
    areaField?: { label: string; placeholder: string };
    sanitizeArea?: (text: string) => string;
    onComplete?: () => void;
    submitLabel?: string;
    /** Hide the in-survey progress bar (e.g. when a parent shows it instead). */
    showProgress?: boolean;
    /** Bindable completion fraction (0–1), so an embedding parent can render it. */
    progress?: number;
    /** Pre-fill answers (e.g. from an OMR-scanned sheet being confirmed). */
    initialAnswers?: Record<string, number>;
    /** Pre-fill the bothersome-area text (e.g. from a filled/scanned sheet). */
    initialArea?: string;
    /** Pre-fill the comments text (e.g. from a filled/scanned sheet). */
    initialComments?: string;
    /** These regions carried content on the scan/PDF, so the reviewer must
     *  confirm them: highlight the fields and require them to stay filled. */
    requireArea?: boolean;
    requireComments?: boolean;
    /** Zoomed crop of the scanned bothersome-area handwriting, pinned next to
     *  the field so the reviewer can transcribe/verify it directly. */
    areaCropUrl?: string;
    /** Correction-mark outcome for the area crop: `cleaned` = marks were
     *  removed before reading (verify); `unread` = marks dominated, so it must
     *  be entered from the crop. Drives the field's hint text. */
    areaCorrection?: 'cleaned' | 'unread';
    /** Answer keys flagged by the OMR read; matching questions are highlighted. */
    attentionKeys?: string[];
  } = $props();

  let answers = $state<Record<string, number>>({ ...(initialAnswers ?? {}) });
  let area = $state(initialArea ?? '');
  let comments = $state(initialComments ?? '');
  let submitAttempted = $state(false);

  function setAnswer(key: string, value: number): void {
    // Fresh object so Svelte 5 picks up the change reliably
    answers = { ...answers, [key]: value };
  }

  // Each symptom needs exactly one answer (no follow-ups).
  const missing = $derived(
    questions.filter((q) => answers[`${q.symptom}_exp`] === undefined),
  );

  const isComplete = $derived(missing.length === 0);

  // Text fields the reviewer must fill because the scanned region had ink.
  const areaMissing = $derived(submitAttempted && !!requireArea && area.trim().length === 0);
  const commentsMissing = $derived(submitAttempted && !!requireComments && comments.trim().length === 0);

  const totalQuestions = $derived(questions.length);
  const answeredQuestions = $derived(
    Object.values(answers).filter((v) => v !== undefined).length,
  );

  // Report progress up so an embedding parent (e.g. the modal header) can
  // render the bar itself.
  $effect(() => {
    progress = totalQuestions > 0 ? Math.min(1, answeredQuestions / totalQuestions) : 0;
  });

  function handleSubmit(e: Event): void {
    e.preventDefault();
    submitAttempted = true;
    if (!isComplete) {
      // Scroll the first missing question into view
      const firstMissing = missing[0];
      const el = document.getElementById(`q-${firstMissing.symptom}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if ((requireArea && !area.trim()) || (requireComments && !comments.trim())) {
      const id = requireArea && !area.trim() ? 'bothersome_area' : 'other_comments';
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const response: Record<string, number | string> = { ...answers };
    if (areaField) {
      const cleanedArea = sanitizeArea ? sanitizeArea(area) : area.trim();
      if (cleanedArea.length > 0) {
        response.bothersome_area = cleanedArea;
      }
    }
    if (comments.trim().length > 0) {
      response.other_comments = comments.trim();
    }

    const result = score(response);
    storeSet(`${slug}:response`, response);
    storeSet(`${slug}:result`, result);
    if (onComplete) {
      onComplete();
      return;
    }
    window.location.href = resultsUrl;
  }
</script>

<form class="survey" onsubmit={handleSubmit} novalidate>
  {#if showProgress}
    <div class="survey__progress" aria-hidden="true">
      <div
        class="survey__progress-bar"
        style:width={`${Math.min(100, (answeredQuestions / totalQuestions) * 100)}%`}
      ></div>
    </div>
  {/if}

  <p class="survey__intro">{intro}</p>

  {#if areaField}
    <div class="area">
      <label for="bothersome_area" class="area__label">
        {areaField.label}
        {#if requireArea}<span class="req" title="Written on the sheet — please confirm">*</span>{/if}
      </label>
      <input
        id="bothersome_area"
        class="area__input"
        class:field--error={areaMissing}
        class:field--flagged={requireArea && !areaMissing}
        type="text"
        bind:value={area}
        placeholder={areaField.placeholder}
      />
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
      {/if}
    </div>
  {/if}

  <ol class="survey__list">
    {#each questions as q, i (q.symptom)}
      {@const expKey = `${q.symptom}_exp`}
      {@const expValue = answers[expKey] ?? null}
      {@const flagMissing = submitAttempted && expValue === null}
      {@const flagged = (attentionKeys?.includes(expKey) ?? false) && expValue === null}

      <li class="question" class:question--flagged={flagged} id={`q-${q.symptom}`}>
        <div class="question__head">
          <span class="question__num" class:question__num--flagged={flagged}>{i + 1}</span>
          <div class="question__body">
            <h3 class="question__title">{q.symptomLabel}</h3>
            {#if q.description}
              <p class="question__desc">{q.description}</p>
            {/if}
            {#if flagged}
              <span class="question__flag">
                <span class="material-symbols-outlined" aria-hidden="true">error</span>
                Scan unclear here — please confirm from your sheet
              </span>
            {/if}
          </div>
        </div>

        <RatingScale
          label={`Experience of ${q.symptomLabel}`}
          options={experienceOptions}
          value={expValue}
          name={expKey}
          onChange={(v) => setAnswer(expKey, v)}
        />
        {#if flagMissing}
          <p class="question__error">Please select an option.</p>
        {/if}
      </li>
    {/each}
  </ol>

  <div class="comments">
    <label for="other_comments" class="comments__label">
      If there is anything you would like to say about these or any other symptoms, please enter below.
      {#if requireComments}<span class="req" title="Written on the sheet — please confirm">*</span>{/if}
    </label>
    <textarea
      id="other_comments"
      class="comments__input"
      class:field--error={commentsMissing}
      class:field--flagged={requireComments && !commentsMissing}
      rows="4"
      bind:value={comments}
      placeholder={requireComments ? 'Please enter the comment from the scan' : 'Optional'}
    ></textarea>
    {#if commentsMissing}
      <p class="field__error">This was written on the scanned sheet — please enter it from the scan.</p>
    {:else if requireComments}
      <p class="field__hint">From the scanned sheet — please verify against the scan.</p>
    {/if}
  </div>

  <div class="actions">
    {#if submitAttempted && !isComplete}
      <p class="actions__hint">
        {missing.length} question{missing.length === 1 ? '' : 's'} still to answer.
      </p>
    {/if}
    <button type="submit" class="btn btn--primary actions__submit">
      {submitLabel}
    </button>
  </div>
</form>

<style>
  .survey__progress {
    position: sticky;
    top: 0;
    height: 4px;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: var(--space-6);
    z-index: 10;
  }

  .survey__progress-bar {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s ease-out;
  }

  .survey__intro {
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
    font-size: 0.95rem;
  }

  .survey__list {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-7) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .question {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-5);
  }

  .question--flagged {
    background: var(--color-warning-tint, #fdf6e3);
    box-shadow: inset 3px 0 0 var(--color-warning, #b8860b);
    border-radius: var(--radius-md);
    padding: var(--space-4) var(--space-4) var(--space-4) var(--space-5);
    margin: 0 calc(-1 * var(--space-4));
    border-top-color: transparent;
  }

  .question__num--flagged {
    background: var(--color-warning, #b8860b);
    color: #fff;
  }

  .question__flag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-top: var(--space-2);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-warning, #b8860b);
  }

  .question__flag .material-symbols-outlined {
    font-size: 1rem;
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

  .question__error {
    color: var(--color-danger);
    font-size: 0.9rem;
    margin: var(--space-2) 0 0 0;
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

  .area__crop {
    margin: var(--space-2) 0 0 0;
    padding: var(--space-2);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-subtle, #f8f8f8);
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

  .comments {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-5);
    margin-bottom: var(--space-6);
  }

  .req {
    color: var(--color-danger);
    font-weight: 700;
    margin-left: 2px;
  }

  .field--error {
    border-color: var(--color-danger) !important;
  }

  .field__error {
    color: var(--color-danger);
    font-size: 0.85rem;
    margin: var(--space-2) 0 0 0;
  }

  .field--flagged {
    border-color: var(--color-warning, #b8860b) !important;
    background: var(--color-warning-tint, #fdf6e3);
  }

  .field__hint {
    color: var(--color-warning, #b8860b);
    font-size: 0.85rem;
    margin: var(--space-2) 0 0 0;
  }

  .comments__label {
    display: block;
    font-size: 0.95rem;
    font-weight: 500;
    margin-bottom: var(--space-3);
  }

  .comments__input {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.95rem;
    resize: vertical;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .comments__input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: stretch;
    gap: var(--space-3);
  }

  .actions__hint {
    color: var(--color-danger);
    font-size: 0.9rem;
    margin: 0;
    text-align: center;
  }

  .actions__submit {
    align-self: center;
    padding: var(--space-3) var(--space-7);
    font-size: 1rem;
  }
</style>
