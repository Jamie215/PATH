<script lang="ts">
  /**
   * Patient assessment flow for the acute pain-classification pathway.
   *
   * Replaces the professional's card collection with a simple one-test-per-page
   * walk-through: each of the four tests is shown as its normal survey, a Next
   * button advances to the next test, and Back returns to the previous one with
   * answers pre-filled so they can be edited. After the last test the patient
   * lands on the review view. A "Download test" button (top right) compiles the
   * completed tests into a single downloadable copy at any point.
   *
   * Patients never see a score or the composite classification.
   */
  import { onMount } from 'svelte';
  import { get as storeGet, set as storeSet } from '../lib/storage';
  import MSISurvey from './MSISurvey.svelte';
  import BriefSLANSSSurvey from './BriefSLANSSSurvey.svelte';
  import FreBAQSurvey from './FreBAQSurvey.svelte';
  import PHQ4Survey from './PHQ4Survey.svelte';
  import { ACUTE_CHILDREN, KEYS, type Role, type ChildAssessment } from '../assessments/pain-classification/config';

  let ready = $state(false);
  let step = $state(0);
  // Completion fraction (0–1) of the current test, bound from the survey so the
  // header bar can render overall progress across all four tests.
  let surveyProgress = $state(0);
  let downloadBusy = $state(false);
  let downloadError = $state<string | null>(null);

  const total = ACUTE_CHILDREN.length;
  const child = $derived(ACUTE_CHILDREN[step]);
  const isLast = $derived(step === total - 1);
  const overall = $derived(Math.min(1, (step + surveyProgress) / total));

  /** Pre-fill values for a test, pulled from any answers it already has stored
   *  (so returning to edit shows the previous responses). */
  function initialFor(c: ChildAssessment): { answers: Record<string, number>; comments?: string; area?: string } {
    const r = storeGet<Record<string, number | string>>(`${c.slug}:response`) ?? {};
    const answers: Record<string, number> = {};
    let comments: string | undefined;
    let area: string | undefined;
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'number') answers[k] = v;
      else if (k === 'other_comments' && typeof v === 'string') comments = v;
      else if (k === 'bothersome_area' && typeof v === 'string') area = v;
    }
    return { answers, comments, area };
  }
  const initial = $derived(initialFor(child));

  onMount(() => {
    const role = storeGet<Role>(KEYS.role);
    if (!role) {
      window.location.replace('/pain-classification/');
      return;
    }
    // MSI is role-gated: its survey redirects if no role is stored, so seed the
    // role key(s) before any survey renders.
    for (const c of ACUTE_CHILDREN) if (c.roleKey) storeSet(c.roleKey, role);
    ready = true;
  });

  /** Mirror a finished survey's scored sub-scores into the composite's manual
   *  store, so completion tracking (and the review guard) see this test done. */
  function persistCompletion(c: ChildAssessment): void {
    const extracted = c.fromResult(storeGet(c.resultKey));
    if (extracted) storeSet(KEYS.manualPrefix + c.slug, extracted);
  }

  function handleComplete(c: ChildAssessment): void {
    persistCompletion(c);
    if (isLast) {
      window.location.href = '/pain-classification/review/';
      return;
    }
    step += 1;
    surveyProgress = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function back(): void {
    if (step === 0) {
      window.location.href = '/pain-classification/';
      return;
    }
    step -= 1;
    surveyProgress = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Compile every test into one downloadable PDF (each form carrying whatever
   *  answers are stored so far), the same record offered on the review view. */
  async function downloadAll(): Promise<void> {
    downloadBusy = true;
    downloadError = null;
    try {
      const { generateCombinedAnswerSheets, buildCombinedAnswerSheetFilename } = await import('../lib/omr-sheet');
      const today = new Date().toLocaleDateString();
      const entries = ACUTE_CHILDREN.filter((c) => c.omrTemplate).map((c) => {
        const response = storeGet<Record<string, number | string>>(`${c.slug}:response`) ?? {};
        return { template: c.omrTemplate!, answers: { ...response, patient_date: today } };
      });
      const bytes = await generateCombinedAnswerSheets(entries);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildCombinedAnswerSheetFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      downloadError = err instanceof Error ? err.message : 'Could not prepare the download.';
    } finally {
      downloadBusy = false;
    }
  }
</script>

{#if ready}
  <section class="flow">
    <header class="flow__bar">
      <button type="button" class="flow__back" onclick={back}>
        <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
        {step === 0 ? 'Back' : 'Previous test'}
      </button>
      <span class="flow__step">Test {step + 1} of {total}</span>
      <button
        type="button"
        class="btn btn--secondary flow__download"
        onclick={downloadAll}
        disabled={downloadBusy}
      >
        <span class="material-symbols-outlined" aria-hidden="true">download</span>
        {downloadBusy ? 'Preparing…' : 'Download test'}
      </button>
    </header>

    <div class="flow__progress" aria-hidden="true">
      <div class="flow__progress-bar" style:width={`${Math.round(overall * 100)}%`}></div>
    </div>

    {#if downloadError}
      <p class="flow__error" role="alert">{downloadError}</p>
    {/if}

    <h1 class="flow__title">{child.shortName}</h1>
    <p class="flow__desc">{child.description}</p>

    {#key child.slug}
      {#if child.slug === 'msi'}
        <MSISurvey
          initialAnswers={initial.answers}
          initialComments={initial.comments}
          onComplete={() => handleComplete(child)}
          submitLabel={isLast ? 'Finish & review' : 'Next test'}
          showProgress={false}
          bind:progress={surveyProgress}
        />
      {:else if child.slug === 'briefslanss'}
        <BriefSLANSSSurvey
          initialAnswers={initial.answers}
          initialComments={initial.comments}
          onComplete={() => handleComplete(child)}
          submitLabel={isLast ? 'Finish & review' : 'Next test'}
          showProgress={false}
          bind:progress={surveyProgress}
        />
      {:else if child.slug === 'frebaq'}
        <FreBAQSurvey
          initialAnswers={initial.answers}
          initialArea={initial.area}
          initialComments={initial.comments}
          onComplete={() => handleComplete(child)}
          submitLabel={isLast ? 'Finish & review' : 'Next test'}
          showProgress={false}
          bind:progress={surveyProgress}
        />
      {:else if child.slug === 'phq4'}
        <PHQ4Survey
          initialAnswers={initial.answers}
          initialComments={initial.comments}
          onComplete={() => handleComplete(child)}
          submitLabel={isLast ? 'Finish & review' : 'Next test'}
          showProgress={false}
          bind:progress={surveyProgress}
        />
      {/if}
    {/key}
  </section>
{/if}

<style>
  .flow {
    padding-top: var(--space-2);
  }

  /* Top bar: Back on the left, step indicator in the middle, Download on the
     right. Sticky so Download stays reachable while a long test scrolls. */
  .flow__bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }

  .flow__back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    background: none;
    border: none;
    padding: var(--space-1) var(--space-2);
    color: var(--color-text-muted);
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: var(--radius-md);
  }
  .flow__back:hover {
    color: var(--color-text);
    background: var(--color-primary-tint-ghost);
  }
  .flow__back .material-symbols-outlined {
    font-size: 1.1rem;
  }

  .flow__step {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .flow__download {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.85rem;
    padding: var(--space-2) var(--space-4);
    white-space: nowrap;
  }
  .flow__download .material-symbols-outlined {
    font-size: 1.1rem;
  }

  .flow__progress {
    height: 4px;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
    margin: var(--space-3) 0 var(--space-5);
  }

  .flow__progress-bar {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s ease-out;
  }

  .flow__title {
    margin: 0 0 var(--space-2) 0;
  }

  .flow__desc {
    color: var(--color-text-muted);
    margin: 0 0 var(--space-6) 0;
    max-width: 60ch;
  }

  .flow__error {
    margin: 0 0 var(--space-4) 0;
    padding: var(--space-3);
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
    border-radius: var(--radius-md);
  }

  @media (max-width: 560px) {
    .flow__step {
      display: none;
    }
    .flow__download {
      font-size: 0.8rem;
      padding: var(--space-2) var(--space-3);
    }
  }
</style>
