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
  import { set as storeSet, remove as storeRemove } from '../lib/storage';
  import { KEYS, RETURN_URL, type PainType, type Role } from '../assessments/pain-classification/config';

  let painType = $state<PainType | null>(null);

  function choosePainType(t: PainType): void {
    painType = t;
    storeSet<PainType>(KEYS.painType, t);
  }

  function chooseRole(role: Role): void {
    storeSet<Role>(KEYS.role, role);
    // Start the collection fresh: drop any stale manual entries.
    ['msi', 'briefslanss', 'frebaq', 'phq4'].forEach((slug) =>
      storeRemove(KEYS.manualPrefix + slug),
    );
    window.location.href = RETURN_URL;
  }
</script>

<section class="intake">
  <h1 class="intake__heading">Pain Classification</h1>
  <p class="intake__lede">
    A composite assessment that combines the MSI, BriefSLANSS, FreBAQ and PHQ-4
    to classify a pain presentation.
  </p>

  <!-- Q1: Pain type -->
  <div class="intake__prompt">
    <h2 class="intake__question">What type of pain are you assessing?</h2>
    <div class="intake__choices">
      <button
        type="button"
        class="choice"
        class:choice--selected={painType === 'acute'}
        onclick={() => choosePainType('acute')}
      >
        <span class="choice__title">Acute</span>
        <span class="choice__desc">Recent-onset pain. Ready to assess.</span>
      </button>

      <button
        type="button"
        class="choice"
        class:choice--selected={painType === 'chronic'}
        onclick={() => choosePainType('chronic')}
      >
        <span class="choice__title">Chronic</span>
        <span class="choice__desc">Persistent pain. Additional configuration coming soon.</span>
      </button>
    </div>
  </div>

  <!-- Q2: Role (acute only, revealed after pain type) -->
  {#if painType === 'acute'}
    <div class="intake__prompt">
      <h2 class="intake__question">Which best describes you?</h2>
      <div class="intake__choices">
        <button type="button" class="choice" onclick={() => chooseRole('patient')}>
          <span class="choice__title">I'm a patient</span>
        </button>
        <button type="button" class="choice" onclick={() => chooseRole('professional')}>
          <span class="choice__title">I'm a healthcare professional</span>
        </button>
      </div>
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

  .intake__prompt {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-6);
    margin-bottom: var(--space-6);
  }

  .intake__question {
    font-size: 1.15rem;
    margin-bottom: var(--space-4);
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

  @media (max-width: 560px) {
    .intake__choices {
      grid-template-columns: 1fr;
    }
  }
</style>
