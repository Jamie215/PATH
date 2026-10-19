<script lang="ts">
  /**
   * Captioned frame for a Chart.js canvas. The wrapper carries the chart's
   * accessible name (role="img"), since a <canvas> can't take that role itself.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    caption: string;
    /** Text alternative describing what the chart shows. */
    description: string;
    variant: 'bar' | 'radar';
    children: Snippet;
  }

  let { caption, description, variant, children }: Props = $props();
</script>

<figure class="chart-figure" class:chart-figure--radar={variant === 'radar'}>
  <figcaption class="chart-figure__caption">{caption}</figcaption>
  <div class="chart-figure__canvas chart-figure__canvas--{variant}" role="img" aria-label={description}>
    {@render children()}
  </div>
</figure>

<style>
  .chart-figure {
    margin: 0;
    padding: var(--space-5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .chart-figure--radar {
    align-items: center;
  }

  .chart-figure__caption {
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--color-text);
    text-align: center;
    margin-bottom: var(--space-3);
  }

  .chart-figure__canvas {
    position: relative;
    width: 100%;
  }

  .chart-figure__canvas--bar {
    height: 200px;
    margin-top: var(--space-5);
  }

  .chart-figure__canvas--radar {
    max-width: 420px;
    aspect-ratio: 1 / 1;
  }
</style>
