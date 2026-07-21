<script lang="ts">
  /**
   * MSI intake page. Asks the filter question (patient vs professional)
   * before the survey, stores the answer in sessionStorage, and routes
   * to the survey.
   *
   * Asking the role up front is a deliberate change from the original
   * PythonAnywhere flow (which asked after submission via a modal).
   * It simplifies state flow and matches what other assessments
   * (e.g. acute vs chronic for Pain Classification) will need.
   */
  import { set as storeSet, remove as storeRemove } from '../lib/storage';
  import type { MSIRole } from '../assessments/msi/questions';

  let role = $state<MSIRole | null>(null);

  function selectRole(r: MSIRole): void {
    role = r;
  }

  function proceed(): void {
    if (!role) return;
    storeSet<MSIRole>('msi:role', role);
    // Clear any stale prior result so the survey starts fresh
    storeRemove('msi:result');
    storeRemove('msi:response');
    window.location.href = '/msi/survey/';
  }
</script>

<section class="intake">
  <h1 class="intake__heading">Multi-Dimensional Symptom Index</h1>
  <p class="intake__lede">
    A ten-symptom screening that gathers frequency and bothersomeness ratings.
    Takes about 5 minutes.
  </p>

  <div class="intake__prompt">
    <h2 class="intake__question">Which best describes you?</h2>

    <div class="intake__choices">
      <button
        type="button"
        class="choice"
        class:choice--selected={role === 'patient'}
        onclick={() => selectRole('patient')}
      >
        <span class="choice__title">I'm a patient</span>
      </button>

      <button
        type="button"
        class="choice"
        class:choice--selected={role === 'professional'}
        onclick={() => selectRole('professional')}
      >
        <span class="choice__title">I'm a healthcare professional</span>
      </button>
    </div>
  </div>

  <div class="intake__actions">
    <button type="button" class="btn btn--primary intake__next" disabled={!role} onclick={proceed}>
      Next
    </button>
  </div>
</section>

<style>
  .intake {
    padding-top: var(--space-4);
  }

  .intake__heading {
    margin-bottom: var(--space-3);
  }

  .intake__lede {
    color: var(--color-text-muted);
    margin-bottom: var(--space-7);
    font-size: 1.05rem;
  }

  .intake__prompt {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-6);
  }

  .intake__question {
    font-size: 1.15rem;
    margin-bottom: var(--space-2);
  }

  .intake__hint {
    color: var(--color-text-muted);
    font-size: 0.92rem;
    margin-bottom: var(--space-5);
  }

  .intake__choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .choice {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-5);
    text-align: left;
    background: var(--color-bg);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, transform 0.12s, box-shadow 0.12s;
  }

  .choice:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-tint-ghost);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .choice:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .choice--selected {
    border-color: var(--color-primary);
    background: var(--color-primary-tint-ghost);
  }

  .intake__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--space-6);
  }

  .intake__next {
    padding: var(--space-3) var(--space-7);
    font-size: 1rem;
  }

  .intake__next:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .choice__title {
    font-weight: 600;
    color: var(--color-primary);
    font-size: 1rem;
  }

  .choice__desc {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  @media (max-width: 560px) {
    .intake__choices {
      grid-template-columns: 1fr;
    }
  }
</style>
