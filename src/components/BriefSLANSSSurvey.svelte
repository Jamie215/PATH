<script lang="ts">
  /**
   * Brief S-LANSS survey — four Yes/No items. All rendering and flow live in
   * the generic SingleGroupSurvey; this wrapper only supplies the Brief S-LANSS
   * configuration and forwards the embedding/scan-review props through.
   */
  import SingleGroupSurvey from './SingleGroupSurvey.svelte';
  import { QUESTIONS, EXPERIENCE_OPTIONS } from '../assessments/briefslanss/questions';
  import { score, type briefSLANSSResponse } from '../assessments/briefslanss/scoring';

  let { progress = $bindable(0), ...rest } = $props();
</script>

<SingleGroupSurvey
  questions={QUESTIONS}
  experienceOptions={EXPERIENCE_OPTIONS}
  intro="For each item below, indicate whether you have experienced the symptom."
  slug="briefslanss"
  resultsUrl="/briefslanss/results/"
  score={(r) => score(r as unknown as briefSLANSSResponse)}
  bind:progress
  {...rest}
/>
