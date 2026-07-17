<script lang="ts">
  /**
   * Renders the 6 FreBAQ symptom questions.
   *
   * Each question is a 5 scale rating. On submit,
   * the response is scored client-side, stored in sessionStorage,
   * and the user is routed to the results page.
   */
  import RatingScale from './RatingScale.svelte';
  import {
    QUESTIONS,
    EXPERIENCE_OPTIONS,
  } from '../assessments/frebaq/questions';
  import { score, type freBAQResponse } from '../assessments/frebaq/scoring';
  import { set as storeSet } from '../lib/storage';

  type AnswerKey = `${(typeof QUESTIONS)[number]['symptom']}_exp`;

  let answers = $state<Partial<Record<AnswerKey, number>>>({});
  let comments = $state('');
  let submitAttempted = $state(false);

  function setAnswer(key: AnswerKey, value: number): void {
    // Fresh object so Svelte 5 picks up the change reliably
    answers = { ...answers, [key]: value };
  }

  // Each symptom needs exactly one answer (no follow-ups).
  const missing = $derived(
    QUESTIONS.filter(
      (q) => answers[`${q.symptom}_exp` as AnswerKey] === undefined,
    ),
  );

  const isComplete = $derived(missing.length === 0);

  const totalQuestions = QUESTIONS.length;
  const answeredQuestions = $derived(
    Object.values(answers).filter((v) => v !== undefined).length,
  );

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

    const response: Record<string, number | string> = {
      ...(answers as Record<string, number>),
    };
    if (comments.trim().length > 0) {
      response.other_comments = comments.trim();
    }

    const result = score(response as unknown as freBAQResponse);
    storeSet('frebaq:response', response);
    storeSet('frebaq:result', result);
    window.location.href = '/frebaq/results/';
  }
</script>

<form class="survey" onsubmit={handleSubmit} novalidate>
  <div class="survey__progress" aria-hidden="true">
    <div
      class="survey__progress-bar"
      style:width={`${Math.min(100, (answeredQuestions / totalQuestions) * 100)}%`}
    ></div>
  </div>

  <p class="survey__intro">
    For each item below, rate your experience in the area of interest.
  </p>

  <ol class="survey__list">
    {#each QUESTIONS as q, i (q.symptom)}
      {@const expKey = `${q.symptom}_exp` as AnswerKey}
      {@const expValue = answers[expKey] ?? null}
      {@const flagMissing = submitAttempted && expValue === null}

      <li class="question" id={`q-${q.symptom}`}>
        <div class="question__head">
          <span class="question__num">{i + 1}</span>
          <div class="question__body">
            <h3 class="question__title">{q.symptomLabel}</h3>
            {#if q.description}
              <p class="question__desc">{q.description}</p>
            {/if}
          </div>
        </div>

        <RatingScale
          label={`Experience of ${q.symptomLabel}`}
          options={EXPERIENCE_OPTIONS}
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
    </label>
    <textarea
      id="other_comments"
      class="comments__input"
      rows="4"
      bind:value={comments}
      placeholder="Optional"
    ></textarea>
  </div>

  <div class="actions">
    {#if submitAttempted && !isComplete}
      <p class="actions__hint">
        {missing.length} question{missing.length === 1 ? '' : 's'} still to answer.
      </p>
    {/if}
    <button type="submit" class="btn btn--primary actions__submit">
      See results
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
    font-size: 0.85rem;
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
    font-size: 0.88rem;
    margin: 0;
  }

  .question__error {
    color: var(--color-danger);
    font-size: 0.85rem;
    margin: var(--space-2) 0 0 0;
  }

  .comments {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-5);
    margin-bottom: var(--space-6);
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
    flex-direction: column;
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