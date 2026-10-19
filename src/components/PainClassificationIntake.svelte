<script lang="ts">
  /**
   * Pain Classification intake. Two questions, asked in sequence:
   *   1. Pain type — Acute (ready) vs Chronic (follow-up configuration, shown
   *      as "coming soon" for now).
   *   2. Role — patient vs professional (label matches the child assessments).
   *
   * Selections are stored in sessionStorage, then the user is routed to the
   * acute collection page. Chronic short-circuits to a placeholder.
   */
  import { set as storeSet, clearAll as storeClearAll } from '../lib/storage';
  import BackLink from './BackLink.svelte';
  import ChoiceGroup from './intake/ChoiceGroup.svelte';
  import { KEYS, RETURN_URL, type PainType, type Role } from '../assessments/pain-classification/config';

  let painType = $state<PainType | null>(null);
  let role = $state<Role | null>(null);

  function choosePainType(t: PainType): void {
    painType = t;
    if (t !== 'acute') role = null;
  }

  function selectRole(r: Role): void {
    role = r;
  }

  function proceed(): void {
    if (painType !== 'acute' || !role) return;
    // Start the collection fresh: a new run from the intake must not inherit
    // any earlier run's results, responses, comments or manual entries (they
    // all live under the same URL section, so session-clear keeps them).
    storeClearAll();
    storeSet<Role>(KEYS.role, role);
    window.location.href = RETURN_URL;
  }
</script>

<section class="intake">
  <!-- Entry page (reached from the hub): always return to the hub. -->
  <BackLink href="/" />
  <h1 class="intake__heading">Pain Classification</h1>
  <p class="intake__lede">
    A composite assessment that combines the Symptom Index, Sensory Profile,
    Body Awareness and Anxiety &amp; Depression assessments to classify a pain
    presentation.
  </p>

  <ChoiceGroup
    question="What type of pain are you assessing?"
    options={[
      { value: 'acute', title: 'Acute', description: 'Recent-onset pain. Ready to assess.' },
      { value: 'chronic', title: 'Chronic', description: 'Persistent pain. Additional configuration coming soon.' },
    ]}
    value={painType}
    onSelect={choosePainType}
  />

  <!-- Q2: Role (acute only, revealed after pain type) -->
  {#if painType === 'acute'}
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
  {/if}

  {#if painType === 'chronic'}
    <div class="intake__notice">
      <span class="material-symbols-outlined" aria-hidden="true">schedule</span>
      <p>
        The chronic pain pathway needs additional follow-up configuration and
        isn't available yet. The acute pathway is ready now.
      </p>
    </div>
  {/if}
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
    margin-bottom: var(--space-6);
  }

  .intake__next {
    padding: var(--space-3) var(--space-7);
    font-size: 1rem;
  }

  .intake__notice {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-primary-tint-ghost);
    color: var(--color-text-muted);
  }

  .intake__notice p {
    margin: 0;
    font-size: 0.95rem;
  }
</style>
