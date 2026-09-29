<script lang="ts">
  /**
   * Somatic vs Non-somatic diverging bar chart.
   *
   * Renders one horizontal bar that extends LEFT from zero for the somatic
   * percentage and RIGHT from zero for the non-somatic percentage. The
   * left/right bars share a row by using stacked horizontal bars where
   * the somatic value is negated.
   *
   * Reads colors from CSS custom properties so the palette stays in one
   * place (src/styles/global.css).
   */
  import { onMount, onDestroy } from 'svelte';
  import { ensureChartJsRegistered, cssVar, Chart } from '../lib/chart-setup';
  import ChartFigure from './ChartFigure.svelte';

  interface Props {
    somatic: number;
    nonsomatic: number;
    canvasId?: string;
  }

  let { somatic, nonsomatic, canvasId }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(() => {
    if (!canvas) return;
    ensureChartJsRegistered();

    const somaticPct = Math.round((somatic / 60) * 100);
    const nonsomaticPct = Math.round((nonsomatic / 72) * 100);

    const somaticColor = cssVar('--color-primary', '#4F2683');
    const nonsomaticColor = cssVar('--color-accent-warm', '#C97B4F');
    const gridColor = cssVar('--color-border', '#E5E5E5');
    const textColor = cssVar('--color-text-muted', '#5C5C5C');

    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [''],
        datasets: [
          {
            label: 'Somatic',
            data: [-somaticPct],
            backgroundColor: somaticColor,
            borderRadius: 4,
            barPercentage: 0.6,
          },
          {
            label: 'Non-somatic',
            data: [nonsomaticPct],
            backgroundColor: nonsomaticColor,
            borderRadius: 4,
            barPercentage: 0.6,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            min: -100,
            max: 100,
            stacked: true,
            grid: { color: gridColor },
            border: { display: false },
            ticks: {
              color: textColor,
              callback: (value) => `${Math.abs(Number(value))}%`,
            },
          },
          y: {
            stacked: true,
            display: false,
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              boxWidth: 14,
              boxHeight: 14,
              padding: 16,
              font: { size: 13 },
            },
          },
          tooltip: {
            callbacks: {
              title: () => '',
              label: (ctx) =>
                `${ctx.dataset.label}: ${Math.abs(Number(ctx.parsed.x))}%`,
            },
          },
        },
      },
    });
  });

  onDestroy(() => {
    chart?.destroy();
    chart = null;
  });
</script>

<ChartFigure caption="Somatic vs Non-somatic Symptoms % Score" description="Horizontal diverging bar comparing somatic and non-somatic symptom totals" variant="bar">
  <canvas bind:this={canvas} id={canvasId}></canvas>
</ChartFigure>
