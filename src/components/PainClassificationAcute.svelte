<script lang="ts">
  /**
   * Acute pain-classification page. Routes on the role chosen at the intake:
   * patients get the one-test-per-page walk-through (PatientAssessmentFlow),
   * professionals the collection page (pain-classification/Collection). With
   * no role stored, sends the user back to the intake.
   */
  import { onMount } from 'svelte';
  import { get as storeGet } from '../lib/storage';
  import { KEYS, type Role } from '../assessments/pain-classification/config';
  import PatientAssessmentFlow from './PatientAssessmentFlow.svelte';
  import Collection from './pain-classification/Collection.svelte';

  let role = $state<Role | null>(null);

  onMount(() => {
    role = storeGet<Role>(KEYS.role);
    if (!role) window.location.replace('/pain-classification/');
  });
</script>

{#if role === 'patient'}
  <PatientAssessmentFlow />
{:else if role === 'professional'}
  <Collection />
{/if}
