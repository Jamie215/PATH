<script lang="ts">
  /**
   * FreBAQ survey — six 0–4 items, plus a free-text "most bothersome area"
   * field above the questions. All rendering and flow live in the generic
   * SingleGroupSurvey; this wrapper supplies the FreBAQ configuration (including
   * the area field) and forwards the embedding/scan-review props through.
   */
  import SingleGroupSurvey from './SingleGroupSurvey.svelte';
  import { QUESTIONS, EXPERIENCE_OPTIONS } from '../assessments/frebaq/questions';
  import { score, type freBAQResponse } from '../assessments/frebaq/scoring';
  import { sanitizeBothersomeArea } from '../assessments/frebaq/area';

  let { progress = $bindable(0), ...rest } = $props();
</script>

<SingleGroupSurvey
  questions={QUESTIONS}
  experienceOptions={EXPERIENCE_OPTIONS}
  intro="For each item below, rate your experience in the area of interest."
  slug="frebaq"
  resultsUrl="/frebaq/results/"
  score={(r) => score(r as unknown as freBAQResponse)}
  areaField={{
    label: 'The part of my body that has been bothering me the most is:',
    placeholder: 'e.g., right knee, left hand, neck',
  }}
  sanitizeArea={sanitizeBothersomeArea}
  bind:progress
  {...rest}
/>
