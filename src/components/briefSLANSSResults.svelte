<script lang="ts">
  /**
   * briefSLANSS results view.
   *
   * Reads the scored result from sessionStorage and displays:
   *   - Patient name field (used later for PDF generation)
   *   - Scores: computed value based on response
   *   - Comments section
   */
  import { onMount } from 'svelte';
  import { get as storeGet, set as storeSet } from '../lib/storage';
  import { getAssessmentContext, type AssessmentContext } from '../lib/assessment-context';
  import type { briefSLANSSResult } from '../assessments/briefslanss/scoring';

  let result = $state<briefSLANSS | null>(null);
  let loaded = $state(false);
  let parentContext = $state<Assessmentcontext | null>(null);

  // Patient name — bound to input; "Save" commits to displayedName which
  // is what appears in the heading (and later in the PDF).
  let nameInput = $state('');
  let displayedName = $state('');

  // PDF download state — busy flag prevents double-clicks during generation.
  let pdfBusy = $state(false);
  let pdfError = $state<string | null>(null);

  onMount(() => {
    result = storeGet<briefSLANSSResult>('briefslanss:result');
    parentContext = getAssessmentContext();
    const savedName = storeGet<string>('briefslanss:patientName');
    if (savedName) {
      nameInput = savedName;
      displayedName = savedName;
    }
    loaded = true;
    if (!result) {
      window.location.replace('/briefslanss/');
    }
  });

  function saveName(): void {
    const trimmed = nameInput.trim();
    displayedName = trimmed;
    storeSet('briefslanss:patientName', trimmed);
  }

  function handleNameKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    }
  }

  /**
   * Generate the PDF report and trigger a download. The pdf-lib module
   * is lazy-imported so the ~600KB dependency only loads when the user
   * actually requests a download.
   */
  async function downloadPDF(): Promise<void> {
    if (!result) return;
    pdfBusy = true;
    pdfError = null;
    try {
      // Lazy-load pdf-lib only at download time.
      const { generateBriefSLANSSReport, buildFilename } = await import('../lib/briefSLANSS-pdf');
      const bytes = await generateBriefSLANSSReport({
        result,
        patientName: displayedName || nameInput.trim(),
      });

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildFilename(displayedName || nameInput.trim());
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revocation so the browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      pdfError = err instanceof Error ? err.message : 'Could not generate the PDF.';
    } finally {
      pdfBusy = false;
    }
  }

  const NEUROPATHIC_THRESHOLD = 10; //TODO: Confirm this threshold
  const verdict = $derived(
    result && result.total_score >= NEUROPATHIC_THRESHOLD ? 'elevated' : 'normal'
  );
</script>

{#if loaded && result}
  <div class="results">
    <!-- Patient name -->
    <section class="name-section" aria-labelledby="name-heading">
      <label class="name-row" for="patient-name">
        <span id="name-heading" class="name-row__label">Patient name / ID</span>
        <input
          id="patient-name"
          class="name-row__input"
          type="text"
          placeholder="Enter name"
          bind:value={nameInput}
          onkeydown={handleNameKey}
        />
        <button type="button" class="btn btn--primary name-row__save" onclick={saveName}>
          Save
        </button>
      </label>
      {#if displayedName}
        <h2 class="name-display">{displayedName}</h2>
      {/if}
    </section>

    <!-- Summary -->
    <section class="summary" aria-labelledby="summary-heading">
      <h2 id="summary-heading" class="section-heading">Score</h2>
      <p class="section-sub">Assessment score based on response</p>
      <div class="score-card score-card--{verdict}">
        <div class="score-card__number" aria-label="Score {result.total_score}">
            <span class="score-card__value">{result.total_score}</span>
        </div>
        <div class="score-card__verdict">
            <span class="verdict-pill verdict-pill--{verdict}">{result.interpretation}</span>
        </div>
    </section>

    <!-- Comments -->
    <section class="comments-section" aria-labelledby="comments-heading">
      <h2 id="comments-heading" class="section-heading">Other comments</h2>
      <p class="comments-body">{result.comments}</p>
    </section>

    <!-- Actions -->
    <div class="actions">
      <button
        type="button"
        class="btn btn--primary actions__pdf"
        onclick={downloadPDF}
        disabled={pdfBusy}
      >
        {pdfBusy ? 'Generating PDF…' : 'Download as PDF'}
      </button>
      {#if parentContext}
        <a href={parentContext.returnUrl} class="btn btn--secondary">Continue with {parentContext.title}</a>
      {:else}
        <a href="/" class="btn btn--secondary">Return to Home</a>
      {/if}
    </div>
    {#if pdfError}
      <p class="pdf-error" role="alert">PDF download failed: {pdfError}</p>
    {/if}
  </div>
{/if}

<style>
  .results {
    padding-top: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-7);
  }

  /* ----- Patient name ----- */
  .name-section {
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .name-row__label {
    font-weight: 600;
    color: var(--color-text);
  }

  .name-row__input {
    flex: 1;
    min-width: 200px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.95rem;
    color: var(--color-text);
    background: var(--color-bg);
  }

  .name-row__input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }

  .name-display {
    margin: var(--space-4) 0 0 0;
    color: var(--color-primary);
    font-size: 1.4rem;
  }

  /* ----- Section heading style ----- */
  .section-heading {
    font-size: 1.15rem;
    margin: 0 0 var(--space-2) 0;
  }

  .section-sub {
    color: var(--color-text-muted);
    font-size: 0.92rem;
    margin: 0 0 var(--space-4) 0;
  }

  /* ----- Score card ----- */
  .score-card {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-5);
    background: var(--color-bg-alt);
    border: 1px solid var(--color-border);
    border-left-width: 4px;
    border-radius: var(--radius-md);
  }

  .score-card--normal {
    border-left-color: var(--color-primary);
  }

  .score-card--elevated {
    border-left-color: #b45309;   /* amber-700 */
    background: #fffbeb;          /* amber-50  */
  }

  .score-card__number {
    display: flex;
    align-items: baseline;
    gap: 2px;
    line-height: 1;
    min-width: 7ch;
  }

  .score-card__value {
    font-size: 3rem;
    font-weight: 700;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
  }

  .score-card__total {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .score-card__verdict {
    flex: 1;
    min-width: 0;
  }

  .verdict-pill {
    display: inline-block;
    padding: var(--space-2) var(--space-3);
    border-radius: 999px;
    font-weight: 600;
    font-size: 0.95rem;
    line-height: 1.3;
  }

  .verdict-pill--normal {
    background: var(--color-primary-tint-soft);
    color: var(--color-primary);
  }

  .verdict-pill--elevated {
    background: #fde68a;   /* amber-200 */
    color: #78350f;        /* amber-900 */
  }

  @media (max-width: 480px) {
    .score-card {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
    }
  }

  /* ----- Comments ----- */
  .comments-body {
    padding: var(--space-4);
    background: var(--color-bg-alt);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    margin: 0;
    color: var(--color-text);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  /* ----- Actions ----- */
  .actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .actions__pdf {
    min-width: 180px;
  }

  .actions__pdf:disabled {
    cursor: progress;
    opacity: 0.7;
  }

  .pdf-error {
    color: var(--color-danger);
    font-size: 0.88rem;
    margin: var(--space-3) 0 0 0;
  }
</style>
