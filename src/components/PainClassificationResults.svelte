<script lang="ts">
  /**
   * Pain Classification results.
   *
   * Gathers each child's resolved values, runs the composite scorer (the
   * acute "more stable model" — Z-standardisation → four category linear
   * discriminants → softmax), and shows the predicted category with the full
   * probability distribution.
   *
   * Guards: if any child is missing data, redirects back to the collection page.
   */
  import { onMount } from 'svelte';
  import AssessmentDate from './AssessmentDate.svelte';
  import { get as storeGet, set as storeSet } from '../lib/storage';
  import { ACUTE_CHILDREN, KEYS } from '../assessments/pain-classification/config';
  import {
    scoreAcute,
    CATEGORIES,
    type Category,
    type PainClassificationInputs,
    type PainClassificationResult,
  } from '../assessments/pain-classification/scoring';

  let loaded = $state(false);
  let result = $state<PainClassificationResult | null>(null);
  let probs = $state<{ category: Category; prob: number }[]>([]);
  let rows = $state<{ shortName: string; entries: [string, number][]; comment: string }[]>([]);

  // Patient name — bound to input; "Save" commits to displayedName.
  let nameInput = $state('');
  let displayedName = $state('');

  // PDF download state.
  let pdfBusy = $state(false);
  let pdfError = $state<string | null>(null);

  onMount(() => {
    const inputs: PainClassificationInputs = {};
    const display: typeof rows = [];

    for (const child of ACUTE_CHILDREN) {
      const values = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
      if (!values) {
        window.location.replace('/pain-classification/acute/');
        return;
      }
      inputs[child.slug] = values;
      display.push({
        shortName: child.shortName,
        entries: child.manualFields.map((f) => [f.label, values[f.key]] as [string, number]),
        comment: storeGet<string>(KEYS.commentPrefix + child.slug) ?? '',
      });
    }

    rows = display;
    const r = scoreAcute(inputs);
    result = r;
    probs = CATEGORIES.map((c) => ({ category: c, prob: r.probabilities[c] })).sort(
      (a, b) => b.prob - a.prob,
    );

    const savedName = storeGet<string>(KEYS.patientName);
    if (savedName) {
      nameInput = savedName;
      displayedName = savedName;
    }
    loaded = true;
  });

  const pct = (p: number): string => `${(p * 100).toFixed(1)}%`;

  function saveName(): void {
    const trimmed = nameInput.trim();
    displayedName = trimmed;
    storeSet(KEYS.patientName, trimmed);
  }

  function handleNameKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    }
  }

  /**
   * Generate and download the composite PDF. pdf-lib is lazy-imported so the
   * dependency only loads when the user actually requests a download.
   */
  async function downloadPDF(): Promise<void> {
    if (!result) return;
    pdfBusy = true;
    pdfError = null;
    try {
      const { generatePainClassificationReport, buildFilename } = await import(
        '../lib/pain-classification-pdf'
      );
      const bytes = await generatePainClassificationReport({
        classification: result.classification,
        probs: probs.map((p) => ({ category: p.category, prob: p.prob })),
        rows,
        patientName: displayedName || nameInput.trim(),
      });
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildFilename(displayedName || nameInput.trim());
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      pdfError = err instanceof Error ? err.message : 'Could not generate the PDF.';
    } finally {
      pdfBusy = false;
    }
  }
</script>

{#if loaded && result}
  <section class="results">
    <div class="results__topbar">
      <AssessmentDate />
    </div>

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
          oninput={saveName}
        />
        <button type="button" class="btn btn--primary name-row__save" onclick={downloadPDF} disabled={pdfBusy}>
          {pdfBusy ? 'Printing…' : 'Print'}
        </button>
      </label>
    </section>

    <div class="results__headline">
      <p class="results__label">Most likely presentation</p>
      <p class="results__value">{result.classification}</p>
      <p class="results__confidence">
        {pct(result.probabilities[result.classification])} probability
      </p>
    </div>

    <h2 class="results__subhead">Category probabilities</h2>
    <ul class="probs">
      {#each probs as p (p.category)}
        <li class="prob" class:prob--top={p.category === result.classification}>
          <div class="prob__row">
            <span class="prob__name">{p.category}</span>
            <span class="prob__pct">{pct(p.prob)}</span>
          </div>
          <div class="prob__track" aria-hidden="true">
            <div class="prob__bar" style:width={pct(p.prob)}></div>
          </div>
        </li>
      {/each}
    </ul>

    <h2 class="results__subhead">Collected inputs</h2>
    <ul class="inputs">
      {#each rows as row (row.shortName)}
        <li class="inputs__item">
          <h3 class="inputs__name">{row.shortName}</h3>
          <dl class="inputs__grid">
            {#each row.entries as [label, val] (label)}
              <div class="inputs__pair">
                <dt>{label}</dt>
                <dd>{val}</dd>
              </div>
            {/each}
          </dl>
          {#if row.comment}
            <p class="inputs__comment">{row.comment}</p>
          {/if}
        </li>
      {/each}
    </ul>

    <div class="results__actions">
      <a href="/" class="btn btn--secondary">Return to Home</a>
      <a href="/pain-classification/" class="btn btn--primary">Redo Assessment</a>
    </div>
    {#if pdfError}
      <p class="results__pdf-error" role="alert">{pdfError}</p>
    {/if}
  </section>
{/if}

<style>
  .results__topbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: var(--space-5);
  }

  .results__headline {
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--color-primary);
    color: #fff;
    margin-bottom: var(--space-5);
  }

  .results__label {
    margin: 0 0 var(--space-2) 0;
    font-size: 0.9rem;
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .results__value {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .results__confidence {
    margin: var(--space-2) 0 0 0;
    font-size: 0.95rem;
    opacity: 0.85;
  }

  .probs {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-7) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .prob__row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }

  .prob__name {
    font-size: 0.95rem;
    color: var(--color-text-muted);
  }

  .prob__pct {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .prob--top .prob__name {
    color: var(--color-text);
    font-weight: 600;
  }

  .prob__track {
    height: 10px;
    background: var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .prob__bar {
    height: 100%;
    background: var(--color-primary-tint);
    border-radius: 999px;
    transition: width 0.3s ease-out;
  }

  .prob--top .prob__bar {
    background: var(--color-primary);
  }

  .results__subhead {
    font-size: 1.05rem;
    margin: 0 0 var(--space-4) 0;
  }

  .inputs {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-7) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .inputs__item {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }

  .inputs__name {
    font-size: 0.95rem;
    margin: 0 0 var(--space-3) 0;
  }

  .inputs__grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    margin: 0;
  }

  .inputs__pair dt {
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }
  .inputs__pair dd {
    margin: 0;
    font-weight: 600;
  }

  .inputs__comment {
    margin: var(--space-3) 0 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .results__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .results__pdf-error {
    color: var(--color-danger);
    font-size: 0.9rem;
    margin: var(--space-3) 0 0 0;
  }

  .name-section {
    margin-bottom: var(--space-5);
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .name-row__label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .name-row__input {
    flex: 1 1 220px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    background: var(--color-bg);
    color: var(--color-text);
  }

  .name-row__input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-tint-soft);
  }
</style>
