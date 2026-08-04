<script lang="ts">
  /**
   * Patient review view for the acute pain-classification pathway.
   *
   * Patients don't see any scoring or the composite classification (that's the
   * professional's results page). Instead, once every test is complete, they
   * land here to review the set of completed tests and download a single PDF
   * of their filled-in test forms — a record to hand to a clinician — or go
   * back to make changes.
   *
   * Guards: no role → back to intake; any test still incomplete → back to the
   * collection page (this view is only meaningful once all four are done).
   */
  import { onMount } from 'svelte';
  import { get as storeGet } from '../lib/storage';
  import { ACUTE_CHILDREN, KEYS, type Role, type ChildAssessment } from '../assessments/pain-classification/config';

  let loaded = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

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
    loaded = true;
  });

  function goBack(): void {
    window.location.href = '/pain-classification/acute/';
  }

  /**
   * Build one combined PDF: each completed test form rendered with the
   * patient's own answers marked on it (no scores, no interpretation). Answers
   * come from each child's stored survey `:response`, whose keys line up with
   * the sheet's fields; the current date is stamped on each form.
   */
  async function download(): Promise<void> {
    busy = true;
    error = null;
    try {
      const { generateCombinedAnswerSheets, buildCombinedAnswerSheetFilename } = await import('../lib/omr-sheet');
      const today = new Date().toLocaleDateString();
      const entries = ACUTE_CHILDREN.filter((c) => c.omrTemplate).map((c) => {
        const response = storeGet<Record<string, number | string>>(c.slug + ':response') ?? {};
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
      error = err instanceof Error ? err.message : 'Could not prepare the download.';
    } finally {
      busy = false;
    }
  }
</script>

{#if loaded}
  <section class="review">
    <a class="review__back" href="/pain-classification/acute/">&larr; Go back</a>
    <h1 class="review__heading">Review your completed tests</h1>
    <p class="review__lede">
      You've completed all four tests. Download a copy of your completed tests to
      keep or share with your healthcare professional, or go back to make changes.
    </p>

    <ul class="tests">
      {#each ACUTE_CHILDREN as child, i (child.slug)}
        <li class="test">
          <span class="test__num" aria-hidden="true">{i + 1}</span>
          <div class="test__body">
            <h2 class="test__title">{child.shortName}</h2>
            <p class="test__desc">{child.description}</p>
          </div>
          <span class="test__status">
            <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
            Completed
          </span>
        </li>
      {/each}
    </ul>

    {#if error}
      <p class="review__error" role="alert">{error}</p>
    {/if}

    <div class="review__actions">
      <button type="button" class="btn btn--secondary" onclick={goBack}>
        Go back
      </button>
      <button type="button" class="btn btn--primary review__download" onclick={download} disabled={busy}>
        <span class="material-symbols-outlined" aria-hidden="true">download</span>
        {busy ? 'Preparing…' : 'Download completed tests'}
      </button>
    </div>
  </section>
{/if}

<style>
  .review__back {
    display: inline-block;
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
    border-bottom: none;
  }

  .review__heading {
    margin-bottom: var(--space-3);
  }

  .review__lede {
    color: var(--color-text-muted);
    margin-bottom: var(--space-6);
    max-width: 60ch;
  }

  .tests {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-7) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .test {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--color-success);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
  }

  .test__num {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: var(--color-success);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
  }

  .test__body {
    flex: 1 1 auto;
    min-width: 0;
  }

  .test__title {
    font-size: 1.1rem;
    margin: 0;
  }

  .test__desc {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin: var(--space-1) 0 0 0;
  }

  .test__status {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--color-success);
    font-size: 0.9rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .test__status .material-symbols-outlined {
    font-size: 1.1rem;
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

  .review__actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-3);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-6);
  }

  .review__download {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-6);
    font-size: 1rem;
  }

  @media (max-width: 560px) {
    .test {
      flex-wrap: wrap;
    }
    .review__actions {
      flex-direction: column-reverse;
      align-items: stretch;
    }
  }
</style>
