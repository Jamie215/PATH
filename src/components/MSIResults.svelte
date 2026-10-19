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
  import AssessmentDate from './AssessmentDate.svelte';
  import ResultsHeader from './results/ResultsHeader.svelte';
  import ResultsActions from './results/ResultsActions.svelte';
  import { get as storeGet } from '../lib/storage';
  import { PatientNameField, PdfDownload } from '../lib/results.svelte';
  import {
    MAX,
    SUMMARY_MEASURES,
    targetScore,
    type MSIResult,
  } from '../assessments/msi/scoring';
  import type { MSIRole } from '../assessments/msi/questions';
  import SomaticBarChart from './SomaticBarChart.svelte';
  import SymptomRadarChart from './SymptomRadarChart.svelte';

  let result = $state<MSIResult | null>(null);
  let role = $state<MSIRole | null>(null);
  let loaded = $state(false);

  const name = new PatientNameField('msi:patientName');
  const pdf = new PdfDownload();

  const BAR_CANVAS_ID = 'msi-pdf-bar-chart';
  const RADAR_CANVAS_ID = 'msi-pdf-radar-chart';

  onMount(() => {
    result = storeGet<MSIResult>('msi:result');
    role = storeGet<MSIRole>('msi:role');
    name.load();
    loaded = true;
    if (!result || !role) {
      window.location.replace('/msi/');
    }
  });

  /**
   * Generate the PDF report and trigger a download. The pdf-lib module
   * is lazy-imported so the ~600KB dependency only loads when the user
   * actually requests a download.
   */
  async function downloadPDF(): Promise<void> {
    if (!result || !role) return;
    const r = result;
    const activeRole = role;
    await pdf.run(async () => {
      const barCanvas = document.getElementById(BAR_CANVAS_ID) as HTMLCanvasElement | null;
      const radarCanvas = document.getElementById(RADAR_CANVAS_ID) as HTMLCanvasElement | null;
      if (!barCanvas || !radarCanvas) {
        throw new Error('Could not find chart canvases on the page.');
      }

      const somaticBar = barCanvas.toDataURL('image/png');
      const radar = radarCanvas.toDataURL('image/png');

      const { generateMSIReport, buildFilename } = await import('../lib/msi-pdf');
      const bytes = await generateMSIReport({
        result: r,
        role: activeRole,
        patientName: name.value,
        chartImages: { somaticBar, radar },
      });
      return { bytes, filename: buildFilename(name.value) };
    });
  }

  function pct(value: number, max: number): string {
    return `${Math.round((value / max) * 100)}%`;
  }

  function fmt(n: number, decimals: 0 | 1): string {
    return decimals === 0 ? Math.round(n).toString() : n.toFixed(1);
  }

  // Map screening verdicts to a semantic class so we can color-code them.
  // Polarity matters: "Likely" is good news for full recovery but bad news
  // for depression, so the caller says which outcome "Likely" represents.
  function verdictClass(
    v: 'Likely' | 'Unlikely' | 'Unclear',
    likelyIsGood: boolean,
  ): string {
    if (v === 'Unclear') return 'verdict verdict--unclear';
    const good = (v === 'Likely') === likelyIsGood;
    return `verdict verdict--${good ? 'good' : 'bad'}`;
  }
</script>

{#if loaded && result && role}
  <div class="results">
    <AssessmentDate />
    <!-- Patient name -->
    <ResultsHeader {name} {pdf} onDownload={downloadPDF} />

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

        {#each SUMMARY_MEASURES as m (m.key)}
          <div class="score-table__row" role="row">
            <span role="cell" class="score-table__label">{m.label}</span>
            <span role="cell" class="score-table__current">
              <strong>{fmt(result[m.key], m.decimals)}</strong>
              <span class="score-table__pct">{pct(result[m.key], MAX[m.key])}</span>
            </span>
            <span role="cell" class="score-table__target">
              {fmt(targetScore(result, m.key), m.decimals)}
            </span>
          </div>
        {/each}
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
            <dd><span class={verdictClass(result.full_rec, true)}>{result.full_rec}</span></dd>
          </div>
          <div class="screening__row">
            <dt>Potential Major Depressive Disorder</dt>
            <dd><span class={verdictClass(result.mdd, false)}>{result.mdd}</span></dd>
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
    <ResultsActions redoHref="/msi/" error={pdf.error} />
  </div>
{/if}

<style>
  .results {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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
    font-size: 0.9rem;
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
    font-size: 0.9rem;
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
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .verdict--good {
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
    color: var(--color-success);
  }

  .verdict--bad {
    background: color-mix(in srgb, var(--color-danger) 12%, transparent);
    color: var(--color-danger);
  }

  .verdict--unclear {
    background: color-mix(in srgb, var(--color-warning) 14%, transparent);
    color: var(--color-warning);
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
      font-size: 0.9rem;
    }

    .score-table__target::before {
      content: 'Target: ';
      color: var(--color-text-muted);
      font-size: 0.9rem;
      font-weight: 400;
    }
  }
</style>
