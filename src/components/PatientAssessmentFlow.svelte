<script lang="ts">
  /**
   * Patient assessment flow for the acute pain-classification pathway.
   *
   * A one-test-per-page walk-through: each of the four tests is shown as its
   * normal survey, a Next button advances to the next test, and Previous test
   * returns to the prior one with answers pre-filled so they can be edited.
   * A "Download all tests" button (top right) compiles the tests into a single
   * fillable PDF at any point.
   *
   * A `?edit=<slug>` query param opens the flow on one specific test (from the
   * review view's per-test Edit) and, on save, returns straight to review.
   *
   * Patients never see a score or the composite classification.
   */
  import { onMount } from 'svelte';
  import { get as storeGet, set as storeSet } from '../lib/storage';
  import MSISurvey from './MSISurvey.svelte';
  import BriefSLANSSSurvey from './BriefSLANSSSurvey.svelte';
  import FreBAQSurvey from './FreBAQSurvey.svelte';
  import PHQ4Survey from './PHQ4Survey.svelte';
  import BackLink from './BackLink.svelte';
  import { ACUTE_CHILDREN, KEYS, type Role, type ChildAssessment } from '../assessments/pain-classification/config';

  const REVIEW_URL = '/pain-classification/review/';

  let ready = $state(false);
  let step = $state(0);
  // Editing a single test, reached from the review view; save returns to review
  // instead of walking on to the next test.
  let editingSingle = $state(false);
  // Completion fraction (0–1) of the current test, bound from the survey so the
  // page can render overall progress across all four tests.
  let surveyProgress = $state(0);
  let downloadBusy = $state(false);
  let downloadError = $state<string | null>(null);

  const total = ACUTE_CHILDREN.length;
  const child = $derived(ACUTE_CHILDREN[step]);
  const isLast = $derived(step === total - 1);
  const submitLabel = $derived(
    editingSingle ? 'Save & return to review' : isLast ? 'Finish & review' : 'Next test',
  );
  // A trailing arrow reinforces that "Next test" advances the walk-through; the
  // finish/save actions (which leave for review) don't get it.
  const submitIcon = $derived(!editingSingle && !isLast ? 'arrow_forward' : undefined);
  const backLabel = $derived(editingSingle ? 'Back to review' : 'Previous test');
  // The in-survey back control only steps within the flow (to the prior test or
  // back to review). At the first test there's nowhere to step to — leaving the
  // flow entirely is the top-of-page "Go back" control's job — so it's hidden.
  const showStepBack = $derived(editingSingle || step > 0);

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

    // Deep link from the review view to edit one specific test.
    const editSlug = new URLSearchParams(window.location.search).get('edit');
    if (editSlug) {
      const idx = ACUTE_CHILDREN.findIndex((c) => c.slug === editSlug);
      if (idx >= 0) {
        step = idx;
        editingSingle = true;
      }
    }
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
    if (editingSingle || isLast) {
      window.location.href = REVIEW_URL;
      return;
    }
    step += 1;
    surveyProgress = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function back(): void {
    if (editingSingle) {
      window.location.href = REVIEW_URL;
      return;
    }
    if (step === 0) {
      window.location.href = '/pain-classification/';
      return;
    }
    step -= 1;
    surveyProgress = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Compile every test into one fillable PDF (each form carrying whatever
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

{#snippet downloadButton()}
  <button
    type="button"
    class="btn btn--primary flow__download"
    onclick={downloadAll}
    disabled={downloadBusy}
  >
    <span class="material-symbols-outlined" aria-hidden="true">download</span>
    {downloadBusy ? 'Preparing…' : 'Download all tests'}
  </button>
{/snippet}

{#if ready}
  <section class="flow">
    <BackLink fallback="/pain-classification/" />

    {#if !editingSingle}
      <!-- Guidance for the full four-test walk-through, with the download beside it. -->
      <h1 class="flow__heading">Pain Classification</h1>
      <div class="flow__intro">
        <p class="flow__instructions">
          Fill out all four assessments below. Once they're complete, you can review your responses.
          Alternatively, you can download the tests as a PDF to fill out separately and forward to
          your healthcare professional.
        </p>
        {@render downloadButton()}
      </div>

      <header class="flow__bar">
        <div
          class="flow__progress"
          role="progressbar"
          aria-label={`Test ${step + 1} of ${total}`}
          aria-valuemin="1"
          aria-valuemax={total}
          aria-valuenow={step + 1}
        >
          {#each ACUTE_CHILDREN as t, i (t.slug)}
            <div
              class="flow__step"
              class:flow__step--done={i < step}
              class:flow__step--current={i === step}
            >
              <span class="flow__step-num">{i + 1}</span>
              <div class="flow__seg">
                <div
                  class="flow__seg-fill"
                  style:width={`${(i < step ? 1 : i === step ? surveyProgress : 0) * 100}%`}
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </header>
    {:else}
      <header class="flow__bar flow__bar--actions">
        {@render downloadButton()}
      </header>
    {/if}

    {#if downloadError}
      <p class="flow__error" role="alert">{downloadError}</p>
    {/if}

    <h1 class="flow__title">{step + 1}. {child.shortName}</h1>

    {#key child.slug}
      {#if child.slug === 'msi'}
        <MSISurvey
          initialAnswers={initial.answers}
          initialComments={initial.comments}
          onComplete={() => handleComplete(child)}
          onBack={showStepBack ? back : undefined}
          {backLabel}
          {submitLabel}
          {submitIcon}
          showProgress={false}
          bind:progress={surveyProgress}
        />
      {:else if child.slug === 'briefslanss'}
        <BriefSLANSSSurvey
          initialAnswers={initial.answers}
          initialComments={initial.comments}
          onComplete={() => handleComplete(child)}
          onBack={showStepBack ? back : undefined}
          {backLabel}
          {submitLabel}
          {submitIcon}
          showProgress={false}
          bind:progress={surveyProgress}
        />
      {:else if child.slug === 'frebaq'}
        <FreBAQSurvey
          initialAnswers={initial.answers}
          initialArea={initial.area}
          initialComments={initial.comments}
          onComplete={() => handleComplete(child)}
          onBack={showStepBack ? back : undefined}
          {backLabel}
          {submitLabel}
          {submitIcon}
          showProgress={false}
          bind:progress={surveyProgress}
        />
      {:else if child.slug === 'phq4'}
        <PHQ4Survey
          initialAnswers={initial.answers}
          initialComments={initial.comments}
          onComplete={() => handleComplete(child)}
          onBack={showStepBack ? back : undefined}
          {backLabel}
          {submitLabel}
          {submitIcon}
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

  .flow__intro {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .flow__heading {
    margin-bottom: var(--space-3);
  }

  .flow__instructions {
    color: var(--color-text-muted);
    margin-bottom: var(--space-7);
    font-size: 1.05rem;
  }

  /* Top bar: segmented progress (one segment per test) on the left, Download all
     tests on the right. Sticky so both stay reachable while a long test scrolls. */
  .flow__bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }

  .flow__download {
    flex-shrink: 0;
    background: #793CC8;
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

  .flow__title {
    margin: var(--space-5) 0 var(--space-4) 0;
  }

  /* Segmented progress: one numbered chapter per test, split by gaps so each
     assessment reads as its own step. Completed segments fill fully (success),
     the current one fills by within-test progress (primary), upcoming stay empty. */
  .flow__progress {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  /* One chapter: its number, then that test's segment fill. */
  .flow__step {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .flow__step-num {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    background: var(--color-border);
    color: var(--color-text-muted);
  }

  .flow__step--current .flow__step-num {
    background: var(--color-primary);
    color: #fff;
  }

  .flow__step--done .flow__step-num {
    background: var(--color-success);
    color: #fff;
  }

  .flow__seg {
    flex: 1 1 0;
    height: 6px;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .flow__seg-fill {
    height: 100%;
    width: 0;
    background: var(--color-primary);
    transition: width 0.2s ease-out;
  }

  .flow__step--done .flow__seg-fill {
    background: var(--color-success);
  }

  .flow__error {
    margin: var(--space-3) 0 0 0;
    padding: var(--space-3);
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
    border-radius: var(--radius-md);
  }

  @media (max-width: 560px) {
    .flow__intro {
      flex-direction: column;
      align-items: stretch;
    }
    .flow__download {
      justify-content: center;
    }
  }
</style>
