<script lang="ts">
  /**
   * MILESTONE 3 PLACEHOLDER.
   *
   * Bare-bones results display so the end-to-end flow can be tested.
   * Milestone 4 will replace this with the proper results UI: summary
   * table, charts, screening section (gated by role), PDF download, etc.
   */
  import { onMount } from 'svelte';
  import { get as storeGet } from '../lib/storage';
  import type { MSIResult } from '../assessments/msi/scoring';
  import type { MSIRole } from '../assessments/msi/questions';

  let result = $state<MSIResult | null>(null);
  let role = $state<MSIRole | null>(null);
  let loaded = $state(false);

  onMount(() => {
    result = storeGet<MSIResult>('msi:result');
    role = storeGet<MSIRole>('msi:role');
    loaded = true;
    if (!result) {
      // No result in storage → user landed here without submitting; go to intake.
      window.location.replace('/msi/');
    }
  });
</script>

{#if loaded && result}
  <div class="placeholder">
    <p class="placeholder__note">
      <strong>Placeholder results view.</strong>
      The full results UI ships in milestone 4. For now, here are the raw
      scores so we can verify scoring works end-to-end.
    </p>

    <dl class="kv">
      <dt>Role</dt><dd>{role ?? '(not set)'}</dd>
      <dt>Number of symptoms</dt><dd>{result.symp_no} / 10</dd>
      <dt>Mean frequency</dt><dd>{result.freq_mean.toFixed(2)}</dd>
      <dt>Mean bothersomeness</dt><dd>{result.int_mean.toFixed(2)}</dd>
      <dt>Somatic total</dt><dd>{result.somatic} / 60</dd>
      <dt>Non-somatic total</dt><dd>{result.nonsomatic} / 72</dd>
      <dt>Full recovery predicted</dt><dd>{result.full_rec}</dd>
      <dt>Potential MDD</dt><dd>{result.mdd}</dd>
      <dt>Comments</dt><dd>{result.comments}</dd>
    </dl>

    <details class="raw">
      <summary>Per-symptom values</summary>
      <ul>
        {#each result.labels as label, i}
          <li>{label}: <strong>{result.vals[i]}</strong></li>
        {/each}
      </ul>
    </details>

    <p class="actions">
      <a href="/msi/" class="btn btn--secondary">Take MSI again</a>
      <a href="/" class="btn btn--secondary">Return to hub</a>
    </p>
  </div>
{/if}

<style>
  .placeholder {
    padding-top: var(--space-4);
  }

  .placeholder__note {
    padding: var(--space-4);
    background: var(--color-primary-tint-ghost);
    border-left: 3px solid var(--color-primary);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-6);
    color: var(--color-text);
    font-size: 0.92rem;
  }

  .kv {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-2) var(--space-5);
    margin: 0 0 var(--space-6) 0;
  }

  .kv dt {
    color: var(--color-text-muted);
    font-size: 0.92rem;
  }

  .kv dd {
    margin: 0;
    font-weight: 500;
  }

  .raw {
    margin-bottom: var(--space-6);
    color: var(--color-text-muted);
  }

  .raw summary {
    cursor: pointer;
    font-weight: 500;
    color: var(--color-primary);
  }

  .raw ul {
    margin-top: var(--space-3);
    padding-left: var(--space-5);
    line-height: 1.7;
  }

  .actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
</style>
