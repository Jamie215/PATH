<script lang="ts">
  /**
   * Renders the 10 MSI symptom questions, each with a conditional
   * "how bothersome" follow-up shown only when frequency > 0.
   *
   * On submit, the response is scored client-side, stored in
   * sessionStorage along with the user's role, and the user is
   * routed to the results page.
   *
   * Guards against missing intake: if no role is found in storage,
   * redirects back to /msi/.
   */
  import { onMount } from 'svelte';
  import RatingScale from './RatingScale.svelte';
  import {
    QUESTIONS,
    FREQUENCY_OPTIONS,
    INTERFERENCE_OPTIONS,
    type MSIRole,
  } from '../assessments/msi/questions';
  import { score, type MSIResponse } from '../assessments/msi/scoring';
  import { get as storeGet, set as storeSet } from '../lib/storage';

  /**
   * When `onComplete` is supplied (e.g. the survey is embedded in a modal
   * from a parent composite assessment), it is called after scoring instead
   * of navigating to the standalone results page. The scored result is still
   * persisted to sessionStorage either way, so `onComplete` can read it back.
   */
  let { onComplete, submitLabel = 'See results' }: {
    onComplete?: () => void;
    submitLabel?: string;
  } = $props();

  type AnswerKey =
    | `${(typeof QUESTIONS)[number]['symptom']}_freq`
    | `${(typeof QUESTIONS)[number]['symptom']}_interference`;

  let answers = $state<Partial<Record<AnswerKey, number>>>({});
  let comments = $state('');
  let submitAttempted = $state(false);
  let roleConfirmed = $state(false);

  onMount(() => {
    const role = storeGet<MSIRole>('msi:role');
    if (!role) {
      window.location.replace('/msi/');
      return;
    }
    roleConfirmed = true;
  });

  function setAnswer(key: AnswerKey, value: number): void {
    // Mutate a fresh object so Svelte 5 picks up the change reliably
    const next = { ...answers, [key]: value };
    // If frequency drops to 0, drop the matching interference value too
    if (key.endsWith('_freq') && value === 0) {
      const interfKey = key.replace('_freq', '_interference') as AnswerKey;
      delete next[interfKey];
    }
    answers = next;
  }

  // A question is satisfied if freq is answered AND (freq==0 OR interference is answered).
  const missing = $derived(
    QUESTIONS.filter((q) => {
      const freq = answers[`${q.symptom}_freq` as AnswerKey];
      if (freq === undefined) return true;
      if (freq > 0 && answers[`${q.symptom}_interference` as AnswerKey] === undefined) return true;
      return false;
    }),
  );

  const isComplete = $derived(missing.length === 0);

  const totalQuestions = $derived(
    QUESTIONS.length + QUESTIONS.filter((q) => (answers[`${q.symptom}_freq` as AnswerKey] ?? 0) > 0).length,
  );
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

    const response: Record<string, number | string> = { ...(answers as Record<string, number>) };
    if (comments.trim().length > 0) {
      response.other_comments = comments.trim();
    }

    const result = score(response as unknown as MSIResponse);
    storeSet('msi:response', response);
    storeSet('msi:result', result);
    if (onComplete) {
      onComplete();
      return;
    }
    window.location.href = '/msi/results/';
  }
</script>

{#if roleConfirmed}
  <form class="survey" onsubmit={handleSubmit} novalidate>
    <div class="survey__progress" aria-hidden="true">
      <div
        class="survey__progress-bar"
        style:width={`${Math.min(100, (answeredQuestions / totalQuestions) * 100)}%`}
      ></div>
    </div>

    <p class="survey__intro">
      For each symptom, indicate how often you experience it.
      If it occurs, you'll also be asked how bothersome it is.
      Consider only symptoms you believe are due to the condition
      for which you're seeking treatment.
    </p>

    <ol class="survey__list">
      {#each QUESTIONS as q, i (q.symptom)}
        {@const freqKey = `${q.symptom}_freq` as AnswerKey}
        {@const interferenceKey = `${q.symptom}_interference` as AnswerKey}
        {@const freqValue = answers[freqKey] ?? null}
        {@const interferenceValue = answers[interferenceKey] ?? null}
        {@const showInterference = freqValue !== null && freqValue > 0}
        {@const flagMissingFreq = submitAttempted && freqValue === null}
        {@const flagMissingInt = submitAttempted && showInterference && interferenceValue === null}

        <li class="question" id={`q-${q.symptom}`}>
          <div class="question__head">
            <span class="question__num">{i + 1}</span>
            <div class="question__body">
              <h3 class="question__title">
                How often do you experience &ldquo;{q.symptomLabel}&rdquo;?
              </h3>
              {#if q.description}
                <p class="question__desc">{q.description}</p>
              {/if}
            </div>
          </div>

          <RatingScale
            label={`Frequency of ${q.symptomLabel}`}
            options={FREQUENCY_OPTIONS}
            value={freqValue}
            name={freqKey}
            onChange={(v) => setAnswer(freqKey, v)}
          />
          {#if flagMissingFreq}
            <p class="question__error">Please select an option.</p>
          {/if}

          {#if showInterference}
            <div class="question__followup">
              <h4 class="question__followup-title">
                When &ldquo;{q.symptomLabel}&rdquo; occurs, how bothersome is it?
              </h4>
              <RatingScale
                label={`Bothersomeness of ${q.symptomLabel}`}
                options={INTERFERENCE_OPTIONS}
                value={interferenceValue}
                name={interferenceKey}
                onChange={(v) => setAnswer(interferenceKey, v)}
              />
              {#if flagMissingInt}
                <p class="question__error">Please select an option.</p>
              {/if}
            </div>
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
        {submitLabel}
      </button>
    </div>
  </form>
{/if}

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

  .question__followup {
    margin-top: var(--space-4);
    padding-left: var(--space-5);
    border-left: 2px solid var(--color-primary-tint);
  }

  .question__followup-title {
    font-size: 0.95rem;
    font-weight: 500;
    margin: 0 0 var(--space-3) 0;
    color: var(--color-text);
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
