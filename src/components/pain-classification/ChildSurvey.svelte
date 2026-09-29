<script lang="ts">
  /**
   * Renders the survey for one Pain Classification child assessment by slug,
   * forwarding the embedding props. Every place that shows a child's survey
   * (the take-test modal, the upload review, the patient walk-through) goes
   * through here, so adding a child means adding one entry below.
   */
  import type { Component } from 'svelte';
  import MSISurvey from '../MSISurvey.svelte';
  import BriefSLANSSSurvey from '../BriefSLANSSSurvey.svelte';
  import FreBAQSurvey from '../FreBAQSurvey.svelte';
  import PHQ4Survey from '../PHQ4Survey.svelte';
  import type { EmbeddedSurveyProps } from '../survey/types';

  const SURVEYS: Record<string, Component<EmbeddedSurveyProps, object, 'progress'>> = {
    msi: MSISurvey,
    briefslanss: BriefSLANSSSurvey,
    frebaq: FreBAQSurvey,
    phq4: PHQ4Survey,
  };

  interface Props extends EmbeddedSurveyProps {
    slug: string;
  }

  let { slug, progress = $bindable(0), ...rest }: Props = $props();
  const Survey = $derived(SURVEYS[slug]);
</script>

{#if Survey}
  <Survey bind:progress {...rest} />
{/if}
