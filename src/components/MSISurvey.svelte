<script lang="ts">
  /**
   * Renders the 10 MSI symptom questions, each with a conditional
   * "how bothersome" follow-up shown only when frequency > 0.
   *
   * On submit, the response is scored client-side and stored in
   * sessionStorage; the user is routed to the results page, or — when
   * `onComplete` is supplied (the survey is embedded in a parent flow) —
   * that callback runs instead.
   *
   * `requireRole` (the standalone /msi/survey/ page) sends the user back to
   * the MSI intake if no role was chosen; embedded uses don't need a role.
   */
  import { onMount } from 'svelte';
  import RatingScale from './RatingScale.svelte';
  import SurveyShell from './survey/SurveyShell.svelte';
  import QuestionItem from './survey/QuestionItem.svelte';
  import type { EmbeddedSurveyProps } from './survey/types';
  import {
    QUESTIONS,
    FREQUENCY_OPTIONS,
    INTERFERENCE_OPTIONS,
    type MSIRole,
  } from '../assessments/msi/questions';
  import { score, type MSIResponse } from '../assessments/msi/scoring';
  import { get as storeGet, set as storeSet } from '../lib/storage';

  interface Props extends EmbeddedSurveyProps {
    requireRole?: boolean;
  }

  let {
    requireRole = false,
    onComplete,
    onBack,
    backLabel,
    submitLabel = 'See results',
    submitIcon,
    showProgress = true,
    progress = $bindable(0),
    initialAnswers,
    initialComments,
    commentsDetected,
    attentionKeys,
  }: Props = $props();

  const uid = $props.id();
  const questionId = (symptom: string) => `${uid}-q-${symptom}`;

  // Seed from the initial props once; afterwards the form owns its state.
  // svelte-ignore state_referenced_locally
  let answers = $state<Record<string, number>>({ ...(initialAnswers ?? {}) });
  // svelte-ignore state_referenced_locally
  let comments = $state(initialComments ?? '');
  let submitAttempted = $state(false);
  let ready = $state(false);

  onMount(() => {
    if (requireRole && !storeGet<MSIRole>('msi:role')) {
      window.location.replace('/msi/');
      return;
    }
    ready = true;
  });

  function setFrequency(symptom: string, value: number): void {
    answers[`${symptom}_freq`] = value;
    // A symptom that never occurs has no bothersomeness rating.
    if (value === 0) delete answers[`${symptom}_interference`];
  }

  // A question is satisfied if freq is answered AND (freq==0 OR interference is answered).
  const missing = $derived(
    QUESTIONS.filter((q) => {
      const freq = answers[`${q.symptom}_freq`];
      if (freq === undefined) return true;
      return freq > 0 && answers[`${q.symptom}_interference`] === undefined;
    }),
  );

  // Every frequency, plus a bothersomeness follow-up for each symptom that occurs.
  const totalAnswers = $derived(
    QUESTIONS.length + QUESTIONS.filter((q) => (answers[`${q.symptom}_freq`] ?? 0) > 0).length,
  );

  $effect(() => {
    progress = Math.min(1, Object.keys(answers).length / totalAnswers);
  });

  function submit(): void {
    submitAttempted = true;
    if (missing.length > 0) {
      document
        .getElementById(questionId(missing[0].symptom))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const response: Record<string, number | string> = { ...answers };
    if (comments.trim().length > 0) response.other_comments = comments.trim();

    storeSet('msi:response', response);
    storeSet('msi:result', score(response as unknown as MSIResponse));
    if (onComplete) onComplete();
    else window.location.href = '/msi/results/';
  }
</script>

{#if ready}
  <SurveyShell
    intro="For each symptom, indicate how often you experience it. If it occurs, you'll also be asked how bothersome it is. Consider only symptoms you believe are due to the condition for which you're seeking treatment."
    {progress}
    {showProgress}
    bind:comments
    {commentsDetected}
    missingCount={missing.length}
    {submitAttempted}
    {submitLabel}
    {submitIcon}
    {onBack}
    {backLabel}
    onSubmit={submit}
  >
    <ol class="survey-list">
      {#each QUESTIONS as q, i (q.symptom)}
        {@const freqKey = `${q.symptom}_freq`}
        {@const intKey = `${q.symptom}_interference`}
        {@const freqValue = answers[freqKey] ?? null}
        {@const intValue = answers[intKey] ?? null}
        {@const showInterference = freqValue !== null && freqValue > 0}
        {@const freqFlagged = (attentionKeys?.includes(freqKey) ?? false) && freqValue === null}
        {@const intFlagged = (attentionKeys?.includes(intKey) ?? false) && showInterference && intValue === null}

        <QuestionItem
          id={questionId(q.symptom)}
          number={i + 1}
          title={`How often do you experience “${q.symptomLabel}”?`}
          description={q.description}
          flagged={freqFlagged || intFlagged}
        >
          <RatingScale
            label={`Frequency of ${q.symptomLabel}`}
            options={FREQUENCY_OPTIONS}
            value={freqValue}
            onChange={(v) => setFrequency(q.symptom, v)}
          />
          {#if submitAttempted && freqValue === null}
            <p class="field__error">Please select an option.</p>
          {/if}

          {#if showInterference}
            <div class="followup" class:followup--flagged={intFlagged}>
              <h3 class="followup__title">
                When &ldquo;{q.symptomLabel}&rdquo; occurs, how bothersome is it?
              </h3>
              <RatingScale
                label={`Bothersomeness of ${q.symptomLabel}`}
                options={INTERFERENCE_OPTIONS}
                value={intValue}
                onChange={(v) => (answers[intKey] = v)}
              />
              {#if submitAttempted && intValue === null}
                <p class="field__error">Please select an option.</p>
              {/if}
            </div>
          {/if}
        </QuestionItem>
      {/each}
    </ol>
  </SurveyShell>
{/if}

<style>
  .followup {
    margin-top: var(--space-4);
    padding-left: var(--space-5);
    border-left: 2px solid var(--color-primary-tint);
  }

  .followup--flagged {
    box-shadow: inset 3px 0 0 var(--color-warning);
    border-radius: var(--radius-md);
    padding-left: var(--space-4);
  }

  .followup__title {
    font-size: 0.95rem;
    font-weight: 500;
    margin: 0 0 var(--space-3) 0;
    color: var(--color-text);
  }
</style>
