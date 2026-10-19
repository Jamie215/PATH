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
  import BackLink from './BackLink.svelte';
  import ChoiceGroup from './intake/ChoiceGroup.svelte';
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
  <!-- Entry page (reached from the hub): always return to the hub. -->
  <BackLink href="/" />
  <h1 class="intake__heading">Symptom Index</h1>
  <p class="intake__lede">
    A ten-symptom screening that gathers frequency and bothersomeness ratings.
  </p>

  <ChoiceGroup
    question="Which best describes you?"
    options={[
      { value: 'patient', title: "I'm a patient" },
      { value: 'professional', title: "I'm a healthcare professional" },
    ]}
    value={role}
    onSelect={selectRole}
  />

  <div class="intake__actions">
    <button type="button" class="btn btn--next intake__next" disabled={!role} onclick={proceed}>
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

  .intake__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: calc(-1 * var(--space-2));
  }

  .intake__next {
    padding: var(--space-3) var(--space-7);
    font-size: 1rem;
  }
</style>
