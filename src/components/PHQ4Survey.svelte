<script lang="ts">
  /**
   * PHQ-4 survey — four 0–3 items. All rendering and flow live in the generic
   * SingleGroupSurvey; this wrapper only supplies the PHQ-4 configuration and
   * forwards the embedding/scan-review props through.
   */
  import SingleGroupSurvey from './SingleGroupSurvey.svelte';
  import { QUESTIONS, EXPERIENCE_OPTIONS } from '../assessments/phq4/questions';
  import { score, type PHQ4Response } from '../assessments/phq4/scoring';

  let { progress = $bindable(0), ...rest } = $props();
</script>

<SingleGroupSurvey
  questions={QUESTIONS}
  experienceOptions={EXPERIENCE_OPTIONS}
  intro="Over the last 2 weeks, how often have you been bothered by the following?"
  slug="phq4"
  resultsUrl="/phq4/results/"
  score={(r) => score(r as unknown as PHQ4Response)}
  bind:progress
  {...rest}
/>
