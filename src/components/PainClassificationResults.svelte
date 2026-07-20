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
  import { get as storeGet } from '../lib/storage';
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
    loaded = true;
  });

  const pct = (p: number): string => `${(p * 100).toFixed(1)}%`;
</script>

{#if loaded && result}
  <section class="results">
    <a class="results__back" href="/pain-classification/acute/">&larr; Back to assessments</a>

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
    gap: var(--space-3);
  }
</style>
