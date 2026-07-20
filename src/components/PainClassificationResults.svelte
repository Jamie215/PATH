<script lang="ts">
  /**
   * Pain Classification results.
   *
   * Gathers each child's resolved values (manual entry or stored result),
   * runs the composite scorer, and shows the classification.
   *
   * ⚠️ The scorer is currently a stub (see assessments/pain-classification/
   * scoring.ts) — this page renders the inputs it *would* score and a clear
   * "pending weights" notice until the acute weights are wired in.
   *
   * Guards: if any child is missing data, redirects back to the collection page.
   */
  import { onMount } from 'svelte';
  import { get as storeGet } from '../lib/storage';
  import { ACUTE_CHILDREN, KEYS } from '../assessments/pain-classification/config';
  import { scoreAcute, type PainClassificationInputs, type PainClassificationResult } from '../assessments/pain-classification/scoring';

  let loaded = $state(false);
  let result = $state<PainClassificationResult | null>(null);
  let rows = $state<{ shortName: string; entries: [string, number][] }[]>([]);

  onMount(() => {
    const inputs: PainClassificationInputs = {};
    const display: typeof rows = [];

    for (const child of ACUTE_CHILDREN) {
      const savedManual = storeGet<Record<string, number>>(KEYS.manualPrefix + child.slug);
      const values = savedManual ?? child.fromResult(storeGet(child.resultKey));
      if (!values) {
        window.location.replace('/pain-classification/acute/');
        return;
      }
      inputs[child.slug] = values;
      display.push({
        shortName: child.shortName,
        entries: child.manualFields.map((f) => [f.label, values[f.key]] as [string, number]),
      });
    }

    rows = display;
    result = scoreAcute(inputs);
    loaded = true;
  });
</script>

{#if loaded && result}
  <section class="results">
    <a class="results__back" href="/pain-classification/acute/">&larr; Back to assessments</a>

    <div class="results__headline">
      <p class="results__label">Composite classification</p>
      <p class="results__value">{result.classification}</p>
    </div>

    {#if !result.ready}
      <div class="results__notice">
        <span class="material-symbols-outlined" aria-hidden="true">construction</span>
        <p>
          The acute weighting isn't configured yet, so a final classification
          can't be computed. The collected inputs below are ready to feed the
          scorer as soon as the weights are wired in.
        </p>
      </div>
    {/if}

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
        </li>
      {/each}
    </ul>

    <div class="results__actions">
      <a href="/" class="btn btn--secondary">Return to hub</a>
    </div>
  </section>
{/if}

<style>
  .results__back {
    display: inline-block;
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-5);
    border-bottom: none;
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
    font-size: 0.85rem;
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .results__value {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .results__notice {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-primary-tint-ghost);
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
  }
  .results__notice p { margin: 0; font-size: 0.92rem; }

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
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }
  .inputs__pair dd {
    margin: 0;
    font-weight: 600;
  }

  .results__actions {
    display: flex;
    gap: var(--space-3);
  }
</style>
