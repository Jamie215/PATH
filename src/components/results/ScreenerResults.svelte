<script lang="ts">
  /**
   * Results view for a single-total screener (PHQ-4, Brief S-LANSS, FreBAQ).
   *
   * Reads the scored result from sessionStorage and shows the patient name
   * field, the score card (coloured by the screener's band), the optional
   * "most bothersome area", and comments. Cutoffs, bands and report copy all
   * come from the screener's spec — nothing clinical is defined here.
   */
  import { onMount, untrack } from 'svelte';
  import AssessmentDate from '../AssessmentDate.svelte';
  import ResultsHeader from './ResultsHeader.svelte';
  import ResultsActions from './ResultsActions.svelte';
  import { get as storeGet } from '../../lib/storage';
  import { PatientNameField, PdfDownload } from '../../lib/results.svelte';
  import { SCREENER_REPORTS, type ScreenerSlug } from '../../assessments/screener-reports';
  import type { ScreenerResult } from '../../assessments/screening';

  interface Props {
    slug: ScreenerSlug;
  }

  let { slug }: Props = $props();
  const spec = $derived(SCREENER_REPORTS[slug]);
  const homeHref = $derived(`/${slug}/`);

  let result = $state<ScreenerResult | null>(null);
  let bothersomeArea = $state('');
  let loaded = $state(false);

  // The slug is fixed for the page's lifetime, so the storage key is too.
  const name = new PatientNameField(untrack(() => `${slug}:patientName`));
  const pdf = new PdfDownload();

  onMount(() => {
    result = storeGet<ScreenerResult>(`${slug}:result`);
    if (spec.showArea) {
      const response = storeGet<Record<string, unknown>>(`${slug}:response`);
      if (typeof response?.bothersome_area === 'string') bothersomeArea = response.bothersome_area;
    }
    name.load();
    loaded = true;
    if (!result) window.location.replace(homeHref);
  });

  /** pdf-lib is lazy-imported so it only loads when a download is requested. */
  async function downloadPDF(): Promise<void> {
    if (!result) return;
    const r = result;
    await pdf.run(async () => {
      const { generateScreeningReport, buildFilename } = await import('../../lib/screening-pdf');
      const bytes = await generateScreeningReport(spec, { result: r, patientName: name.value });
      return { bytes, filename: buildFilename(spec, name.value) };
    });
  }

  const tone = $derived(result ? spec.scoring.tone(result.total_score) : 'normal');
</script>

{#if loaded && result}
  <div class="results">
    <AssessmentDate />
    <ResultsHeader {name} {pdf} onDownload={downloadPDF} />

    {#if bothersomeArea}
      <section aria-labelledby="area-heading">
        <h2 id="area-heading" class="section-heading">Most bothersome area</h2>
        <p class="area-body">{bothersomeArea}</p>
      </section>
    {/if}

    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" class="section-heading">Score</h2>
      <p class="section-sub">Assessment score based on response</p>
      <div class="score-card score-card--{tone}">
        <p class="score-card__number">
          <span class="score-card__value">{result.total_score}</span>
          <span class="score-card__total">/ {spec.scoring.maxScore}</span>
        </p>
        <div class="score-card__verdict">
          <span class="verdict-pill verdict-pill--{tone}">{result.interpretation}</span>
        </div>
      </div>
    </section>

    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading" class="section-heading">Other comments</h2>
      <p class="comments-body">{result.comments}</p>
    </section>

    <ResultsActions redoHref={homeHref} error={pdf.error} />
  </div>
{/if}

<style>
  .results {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .area-body {
    padding: var(--space-4);
    background: var(--color-bg-alt);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    margin: 0;
    color: var(--color-text);
    font-weight: 500;
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

  .score-card--mild,
  .score-card--moderate,
  .score-card--severe,
  .score-card--elevated {
    background: var(--color-amber-50);
  }
  .score-card--mild { border-left-color: var(--color-amber-200); }
  .score-card--moderate { border-left-color: var(--color-amber-400); }
  .score-card--severe,
  .score-card--elevated { border-left-color: var(--color-amber-700); }

  .score-card__number {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    line-height: 1;
    min-width: 7ch;
    margin: 0;
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
    color: var(--color-amber-900);
  }

  .verdict-pill--normal {
    background: var(--color-primary-tint-soft);
    color: var(--color-primary);
  }
  .verdict-pill--mild,
  .verdict-pill--elevated { background: var(--color-amber-200); }
  .verdict-pill--moderate { background: var(--color-amber-400); }
  .verdict-pill--severe { background: var(--color-amber-500); }

  @media (max-width: 480px) {
    .score-card {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
    }
  }
</style>
