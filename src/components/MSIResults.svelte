<script lang="ts">
  /**
   * MSI results view.
   *
   * Reads the scored result and role from sessionStorage and displays:
   *   - Patient name field (used later for PDF generation)
   *   - Summary scores: current value + target for meaningful change
   *   - Screening section: full recovery prediction + MDD risk
   *     (PROFESSIONAL VIEW ONLY)
   *   - Comments section
   *
   */
  import { onMount } from 'svelte';
  import { get as storeGet, set as storeSet } from '../lib/storage';
  import { getAssessmentContext, type AssessmentContext } from '../lib/assessment-context';
  import type { MSIResult } from '../assessments/msi/scoring';
  import type { MSIRole } from '../assessments/msi/questions';
  import SomaticBarChart from './SomaticBarChart.svelte';
  import SymptomRadarChart from './SymptomRadarChart.svelte';

  let result = $state<MSIResult | null>(null);
  let role = $state<MSIRole | null>(null);
  let loaded = $state(false);
  let parentContext = $state<Assessmentcontext | null>(null);

  // Patient name — bound to input; "Save" commits to displayedName which
  // is what appears in the heading (and later in the PDF).
  let nameInput = $state('');
  let displayedName = $state('');

  // PDF download state — busy flag prevents double-clicks during generation.
  let pdfBusy = $state(false);
  let pdfError = $state<string | null>(null);

  const BAR_CANVAS_ID = 'msi-pdf-bar-chart';
  const RADAR_CANVAS_ID = 'msi-pdf-radar-chart';

  onMount(() => {
    result = storeGet<MSIResult>('msi:result');
    role = storeGet<MSIRole>('msi:role');
    parentContext = getAssessmentContext();
    const savedName = storeGet<string>('msi:patientName');
    if (savedName) {
      nameInput = savedName;
      displayedName = savedName;
    }
    loaded = true;
    if (!result || !role) {
      window.location.replace('/msi/');
    }
  });

  function saveName(): void {
    const trimmed = nameInput.trim();
    displayedName = trimmed;
    storeSet('msi:patientName', trimmed);
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
    if (!result || !role) return;
    pdfBusy = true;
    pdfError = null;
    try {
      const barCanvas = document.getElementById(BAR_CANVAS_ID) as HTMLCanvasElement | null;
      const radarCanvas = document.getElementById(RADAR_CANVAS_ID) as HTMLCanvasElement | null;
      if (!barCanvas || !radarCanvas) {
        throw new Error('Could not find chart canvases on the page.');
      }

      const somaticBar = barCanvas.toDataURL('image/png');
      const radar = radarCanvas.toDataURL('image/png');

      // Lazy-load pdf-lib only at download time.
      const { generateMSIReport, buildFilename } = await import('../lib/msi-pdf');
      const bytes = await generateMSIReport({
        result,
        role,
        patientName: displayedName || nameInput.trim(),
        chartImages: { somaticBar, radar },
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

  /**
   * "Target score for meaningful change" — clamped at zero (a meaningful
   * improvement on an already-low score is still zero, not negative).
   * Thresholds match the original PythonAnywhere template exactly.
   */
  const TARGETS = {
    symp_no: 1.8,
    freq_mean: 0.9,
    int_mean: 1.0,
    somatic: 7.5,
    nonsomatic: 6.1,
  } as const;

  function target(current: number, threshold: number): number {
    return Math.max(0, current - threshold);
  }

  function pct(value: number, max: number): string {
    return `${Math.round((value / max) * 100)}%`;
  }

  function fmtInt(n: number): string {
    return Math.round(n).toString();
  }

  function fmt1(n: number): string {
    return n.toFixed(1);
  }

  // Map screening verdicts to a semantic class so we can color-code them.
  function verdictClass(v: 'Likely' | 'Unlikely' | 'Unclear'): string {
    return `verdict verdict--${v.toLowerCase()}`;
  }
</script>

{#if loaded && result && role}
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

    <!-- Summary scores -->
    <section class="summary" aria-labelledby="summary-heading">
      <h2 id="summary-heading" class="section-heading">Summary scores</h2>
      <p class="section-sub">
        Current values and the score you would need to reach for clinically
        meaningful change.
      </p>

      <div class="score-table" role="table">
        <div class="score-table__head" role="row">
          <span role="columnheader">Measure</span>
          <span role="columnheader">Current</span>
          <span role="columnheader">Target for meaningful change</span>
        </div>

        <div class="score-table__row" role="row">
          <span role="cell" class="score-table__label">Number of symptoms</span>
          <span role="cell" class="score-table__current">
            <strong>{result.symp_no}</strong>
            <span class="score-table__pct">{pct(result.symp_no, 10)}</span>
          </span>
          <span role="cell" class="score-table__target">
            {fmtInt(target(result.symp_no, TARGETS.symp_no))}
          </span>
        </div>

        <div class="score-table__row" role="row">
          <span role="cell" class="score-table__label">Mean frequency</span>
          <span role="cell" class="score-table__current">
            <strong>{fmt1(result.freq_mean)}</strong>
            <span class="score-table__pct">{pct(result.freq_mean, 3)}</span>
          </span>
          <span role="cell" class="score-table__target">
            {fmt1(target(result.freq_mean, TARGETS.freq_mean))}
          </span>
        </div>

        <div class="score-table__row" role="row">
          <span role="cell" class="score-table__label">Mean bothersomeness</span>
          <span role="cell" class="score-table__current">
            <strong>{fmt1(result.int_mean)}</strong>
            <span class="score-table__pct">{pct(result.int_mean, 4)}</span>
          </span>
          <span role="cell" class="score-table__target">
            {fmt1(target(result.int_mean, TARGETS.int_mean))}
          </span>
        </div>

        <div class="score-table__row" role="row">
          <span role="cell" class="score-table__label">Somatic symptoms</span>
          <span role="cell" class="score-table__current">
            <strong>{fmtInt(result.somatic)}</strong>
            <span class="score-table__pct">{pct(result.somatic, 60)}</span>
          </span>
          <span role="cell" class="score-table__target">
            {fmtInt(target(result.somatic, TARGETS.somatic))}
          </span>
        </div>

        <div class="score-table__row" role="row">
          <span role="cell" class="score-table__label">Non-somatic symptoms</span>
          <span role="cell" class="score-table__current">
            <strong>{fmtInt(result.nonsomatic)}</strong>
            <span class="score-table__pct">{pct(result.nonsomatic, 72)}</span>
          </span>
          <span role="cell" class="score-table__target">
            {fmtInt(target(result.nonsomatic, TARGETS.nonsomatic))}
          </span>
        </div>
      </div>
    </section>

    <!-- Screening results: professional view only -->
    {#if role === 'professional'}
      <section class="screening" aria-labelledby="screening-heading">
        <h2 id="screening-heading" class="section-heading">Screening results</h2>
        <p class="section-sub">
          Predictive flags based on the non-somatic symptom total. These are
          indicators, not diagnoses.
        </p>

        <dl class="screening__list">
          <div class="screening__row">
            <dt>Full recovery predicted</dt>
            <dd><span class={verdictClass(result.full_rec)}>{result.full_rec}</span></dd>
          </div>
          <div class="screening__row">
            <dt>Potential Major Depressive Disorder</dt>
            <dd><span class={verdictClass(result.mdd)}>{result.mdd}</span></dd>
          </div>
        </dl>
      </section>
    {/if}

    <!-- Comments -->
    <section class="comments-section" aria-labelledby="comments-heading">
      <h2 id="comments-heading" class="section-heading">Other comments</h2>
      <p class="comments-body">{result.comments}</p>
    </section>

    <!-- Charts -->
    <section class="charts" aria-labelledby="charts-heading">
      <h2 id="charts-heading" class="section-heading">Charts</h2>
      <div class="charts__grid">
        <SomaticBarChart
          somatic={result.somatic}
          nonsomatic={result.nonsomatic}
          canvasId={BAR_CANVAS_ID}
        />
        <SymptomRadarChart
          labels={result.labels}
          values={result.vals}
          canvasId={RADAR_CANVAS_ID}
        />
      </div>
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

  /* ----- Score table ----- */
  .score-table {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .score-table__head,
  .score-table__row {
    display: contents;
  }

  .score-table__head > span {
    background: var(--color-primary-tint-ghost);
    color: var(--color-primary);
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .score-table__row > span {
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .score-table__row:last-child > span {
    border-bottom: none;
  }

  .score-table__label {
    color: var(--color-text);
    font-weight: 500;
  }

  .score-table__current strong {
    font-size: 1.1rem;
    color: var(--color-primary);
  }

  .score-table__pct {
    color: var(--color-text-muted);
    font-size: 0.88rem;
  }

  .score-table__target {
    font-weight: 600;
    color: var(--color-text);
  }

  /* ----- Screening ----- */
  .screening__list {
    margin: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .screening__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .screening__row:last-child {
    border-bottom: none;
  }

  .screening__row dt {
    font-weight: 500;
  }

  .screening__row dd {
    margin: 0;
  }

  .verdict {
    display: inline-block;
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .verdict--likely {
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
    color: var(--color-success);
  }

  .verdict--unlikely {
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
    color: var(--color-danger);
  }

  .verdict--unclear {
    background: color-mix(in srgb, var(--color-warning) 14%, transparent);
    color: var(--color-warning);
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

  /* ----- Charts ----- */
  .charts__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  @media (min-width: 800px) {
    .charts__grid {
      /* Somatic bar : radar = 2 : 3 */
      grid-template-columns: 2fr 3fr;
      align-items: stretch;
    }
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

  /* ----- Responsive ----- */
  @media (max-width: 640px) {
    .score-table {
      grid-template-columns: 1fr;
    }

    .score-table__head {
      display: none;
    }

    .score-table__row > span {
      border-bottom: none;
      padding: var(--space-2) var(--space-4);
    }

    .score-table__row > span:first-child {
      padding-top: var(--space-4);
      font-weight: 600;
    }

    .score-table__row > span:last-child {
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-border);
    }

    .score-table__row:last-child > span:last-child {
      border-bottom: none;
    }

    .score-table__current::before {
      content: 'Current: ';
      color: var(--color-text-muted);
      font-size: 0.88rem;
    }

    .score-table__target::before {
      content: 'Target: ';
      color: var(--color-text-muted);
      font-size: 0.88rem;
      font-weight: 400;
    }
  }
</style>
