<script lang="ts">
  /**
   * Patient review view for the acute pain-classification pathway.
   *
   * Patients don't see any scoring or the composite classification (that's the
   * professional's results page). Once every test is complete, they land here
   * to read back their own answers — a clean, on-screen summary grouped by test
   * — and can download the same answers as a PDF to hand to a clinician, or go
   * back to edit their responses.
   *
   * Guards: no role → back to intake; any test still incomplete → back to the
   * collection page (this view is only meaningful once all four are done).
   */
  import { onMount } from 'svelte';
  import { get as storeGet, set as storeSet } from '../lib/storage';
  import { ACUTE_CHILDREN, KEYS, type Role, type ChildAssessment } from '../assessments/pain-classification/config';
  import { summarizeChild, type ChildSummary } from '../assessments/pain-classification/summary';

  interface AssessmentSummary extends ChildSummary {
    slug: string;
    title: string;
    description: string;
  }

  let loaded = $state(false);
  let summaries = $state<AssessmentSummary[]>([]);
  let downloadBusy = $state(false);
  let downloadError = $state<string | null>(null);

  // Patient name / ID — bound to the input, persisted so it survives an edit
  // round-trip and pre-fills the downloaded answer sheets.
  let nameInput = $state('');

  function childComplete(child: ChildAssessment): boolean {
    const v = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
    return !!v && child.manualFields.every((f) => typeof v[f.key] === 'number' && Number.isFinite(v[f.key]));
  }

  onMount(() => {
    const role = storeGet<Role>(KEYS.role);
    if (!role) {
      window.location.replace('/pain-classification/');
      return;
    }
    if (!ACUTE_CHILDREN.every(childComplete)) {
      window.location.replace('/pain-classification/acute/');
      return;
    }
    summaries = ACUTE_CHILDREN.map((c) => ({
      slug: c.slug,
      title: c.shortName,
      description: c.description,
      ...summarizeChild(c.slug),
    }));
    nameInput = storeGet<string>(KEYS.patientName) ?? '';
    loaded = true;
  });

  function saveName(): void {
    storeSet(KEYS.patientName, nameInput.trim());
  }

  function scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Edit one specific test: reopen the flow on that test; saving returns here. */
  function editAssessment(slug: string): void {
    window.location.href = `/pain-classification/acute/?edit=${slug}`;
  }

  /**
   * Build the combined PDF of the patient's completed test forms (each form
   * carrying their own answers, no scores) and download it. Generated on click
   * so the page stays light; a busy state covers the short build.
   */
  async function download(): Promise<void> {
    downloadBusy = true;
    downloadError = null;
    try {
      const { generateCombinedAnswerSheets, buildCombinedAnswerSheetFilename } = await import('../lib/omr-sheet');
      const today = new Date().toLocaleDateString();
      const name = nameInput.trim();
      const entries = ACUTE_CHILDREN.filter((c) => c.omrTemplate).map((c) => {
        const response = storeGet<Record<string, number | string>>(`${c.slug}:response`) ?? {};
        return {
          template: c.omrTemplate!,
          answers: { ...response, patient_date: today, ...(name ? { patient_name: name } : {}) },
        };
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

{#if loaded}
  <section class="review">
    <h1 class="review__heading">Review your responses</h1>

    <!-- Guidance: what to do with this summary once it looks right. -->
    <div class="review__instructions">
      <span class="material-symbols-outlined review__instructions-icon" aria-hidden="true">info</span>
      <p class="review__instructions-text">
        Please review the responses below to make sure they're correct. When you're ready, download
        your responses and forward the file to your healthcare professional.
      </p>
    </div>

    <!-- Frozen action bar: stays in view while the summary scrolls, so the
         name field and Download are always reachable. -->
    <div class="review__bar">
      <label class="review__name" for="patient-name">
        <span class="review__name-label">Name / ID</span>
        <input
          id="patient-name"
          class="review__name-input"
          type="text"
          placeholder="Enter name or ID"
          bind:value={nameInput}
          oninput={saveName}
        />
      </label>
      <button type="button" class="btn btn--secondary review__top" onclick={scrollToTop}>
        <span class="material-symbols-outlined" aria-hidden="true">arrow_upward</span>
        Scroll to top
      </button>
      <button
        type="button"
        class="btn btn--primary review__download"
        onclick={download}
        disabled={downloadBusy}
      >
        <span class="material-symbols-outlined" aria-hidden="true">download</span>
        {downloadBusy ? 'Preparing…' : 'Download my responses'}
      </button>
    </div>

    {#if downloadError}
      <p class="review__error" role="alert">{downloadError}</p>
    {/if}

    {#each summaries as a, i (a.slug)}
      <section class="assess" aria-labelledby={`assess-${a.slug}`}>
        <header class="assess__head">
          <span class="assess__num" aria-hidden="true">{i + 1}</span>
          <div class="assess__heading">
            <h2 class="assess__title" id={`assess-${a.slug}`}>{a.title}</h2>
            <p class="assess__desc">{a.description}</p>
          </div>
          <button type="button" class="btn btn--secondary assess__edit" onclick={() => editAssessment(a.slug)}>
            <span class="material-symbols-outlined" aria-hidden="true">edit</span>
            Edit
          </button>
        </header>

        {#if a.area}
          <p class="assess__meta"><span class="assess__meta-label">Most bothersome area:</span> {a.area}</p>
        {/if}

        <dl class="qa">
          {#each a.rows as row (row.question)}
            <div class="qa__row">
              <dt class="qa__q">{row.question}</dt>
              <dd class="qa__a" class:qa__a--empty={!row.answer}>{row.answer ?? 'Not answered'}</dd>
            </div>
          {/each}
        </dl>

        {#if a.comments}
          <p class="assess__meta"><span class="assess__meta-label">Comments:</span> {a.comments}</p>
        {/if}
      </section>
    {/each}

    <div class="review__home">
      <a href="/" class="btn btn--secondary">Return to Home</a>
    </div>
  </section>
{/if}

<style>
  .review {
    padding-top: var(--space-2);
  }

  /* Frozen action bar. */
  .review__bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-4) 0;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }

  .review__top,
  .review__download {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    font-size: 1rem;
  }

  /* Make the primary (download) action stand out a little more prominently. */
  .review__download {
    box-shadow: var(--shadow-sm);
  }

  .review__top .material-symbols-outlined,
  .review__download .material-symbols-outlined {
    font-size: 1.15rem;
  }

  .review__heading {
    margin: 0 0 var(--space-4) 0;
  }

  /* Instruction callout. */
  .review__instructions {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
    padding: var(--space-4);
    background: var(--color-primary-tint-ghost);
    border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
    border-radius: var(--radius-md);
  }

  .review__instructions-icon {
    flex-shrink: 0;
    color: var(--color-primary);
    font-size: 1.35rem;
  }

  .review__instructions-text {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--color-text);
  }

  /* Name / ID field, sitting in the action bar. */
  .review__name {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .review__name-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .review__name-input {
    flex: 1 1 200px;
    min-width: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .review__name-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  .review__error {
    margin: 0 0 var(--space-4) 0;
    padding: var(--space-3);
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
    border-radius: var(--radius-md);
  }

  .assess {
    margin-bottom: var(--space-6);
    padding: var(--space-5);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
  }

  .assess__head {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .assess__heading {
    flex: 1 1 auto;
    min-width: 0;
  }

  .assess__edit {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    font-size: 0.85rem;
  }
  .assess__edit .material-symbols-outlined {
    font-size: 1rem;
  }

  .assess__num {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: var(--color-primary-tint-ghost);
    color: var(--color-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }

  .assess__title {
    font-size: 1.2rem;
    margin: 0;
  }

  .assess__desc {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin: var(--space-1) 0 0 0;
  }

  .assess__meta {
    margin: var(--space-3) 0 0 0;
    font-size: 0.95rem;
    color: var(--color-text);
  }

  .assess__meta-label {
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .qa {
    margin: 0;
    display: flex;
    flex-direction: column;
  }

  .qa__row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--color-border);
  }
  .qa__row:first-child {
    border-top: none;
  }

  .qa__q {
    margin: 0;
    font-size: 0.95rem;
    color: var(--color-text);
    flex: 1 1 auto;
    min-width: 0;
  }

  .qa__a {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-primary);
    text-align: right;
    flex-shrink: 0;
    max-width: 45%;
  }

  .qa__a--empty {
    color: var(--color-text-muted);
    font-weight: 400;
    font-style: italic;
  }

  .review__home {
    display: flex;
    justify-content: center;
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-6);
    margin-top: var(--space-2);
  }

  @media (max-width: 560px) {
    .review__bar {
      flex-direction: column;
      align-items: stretch;
    }
    .review__name {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-1);
    }
    .qa__row {
      flex-direction: column;
      gap: var(--space-1);
    }
    .qa__a {
      text-align: left;
      max-width: 100%;
    }
  }
</style>
