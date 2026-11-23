<script lang="ts">
  /**
   * Renders the survey for one Pain Classification child assessment by slug,
   * forwarding the embedding props. Every place that shows a child's survey
   * (the take-test modal, the upload review, the patient walk-through) goes
   * through here. MSI has its own survey; every screener listed in
   * assessments/screeners.ts uses the shared SingleGroupSurvey.
   */
  import MSISurvey from '../MSISurvey.svelte';
  import SingleGroupSurvey from '../SingleGroupSurvey.svelte';
  import type { EmbeddedSurveyProps } from '../survey/types';
  import { findScreener } from '../../assessments/screeners';

  interface Props extends EmbeddedSurveyProps {
    slug: string;
  }

  let { slug, progress = $bindable(0), ...rest }: Props = $props();
</script>

{#if slug === 'msi'}
  <MSISurvey bind:progress {...rest} />
{:else if findScreener(slug)}
  <SingleGroupSurvey {slug} bind:progress {...rest} />
{/if}
