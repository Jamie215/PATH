<script lang="ts">
  /**
   * Per-symptom radar chart. 10 axes — one per MSI symptom — each scaled
   * from 0-12 (the matrix's full range).
   *
   * Reads colors from CSS custom properties so the palette stays in one
   * place (src/styles/global.css).
   */
  import { onMount, onDestroy } from 'svelte';
  import { ensureChartJsRegistered, Chart } from '../lib/chart-setup';

  interface Props {
    labels: string[];
    values: number[];
    canvasId?: string;
  }

  let { labels, values, canvasId }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function cssVar(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  /** Add an alpha channel to a hex color string, e.g. #4F2683 + 0.2 -> rgba(...). */
  function rgba(hex: string, alpha: number): string {
    const m = hex.replace('#', '').match(/.{1,2}/g);
    if (!m || m.length < 3) return hex;
    const [r, g, b] = m.map((c) => parseInt(c, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Wrap a long axis label into 1-2 lines, choosing the word boundary
   * closest to the middle of the string. Chart.js v4 renders an array
   * of strings as a multi-line label.
   */
  function wrapLabel(label: string, maxCharsPerLine = 18): string | string[] {
    if (label.length <= maxCharsPerLine) return label;
    const words = label.split(' ');
    if (words.length === 1) return label;
    let bestSplit = 1;
    let bestMaxLen = Infinity;
    for (let i = 1; i < words.length; i += 1) {
      const left = words.slice(0, i).join(' ');
      const right = words.slice(i).join(' ');
      const maxLen = Math.max(left.length, right.length);
      if (maxLen < bestMaxLen) {
        bestMaxLen = maxLen;
        bestSplit = i;
      }
    }
    return [
      words.slice(0, bestSplit).join(' '),
      words.slice(bestSplit).join(' '),
    ];
  }

  onMount(() => {
    if (!canvas) return;
    ensureChartJsRegistered();

    const primary = cssVar('--color-primary', '#4F2683');
    const gridColor = cssVar('--color-border', '#E5E5E5');
    const textColor = cssVar('--color-text', '#1F1F1F');
    const mutedColor = cssVar('--color-text-muted', '#5C5C5C');

    chart = new Chart(canvas, {
      type: 'radar',
      data: {
        // Spread to plain arrays — Chart.js mutates/adds properties on these,
        // which conflicts with Svelte 5's $state proxies on prop arrays.
        labels: [...labels],
        datasets: [
          {
            label: 'Symptom values',
            data: [...values],
            backgroundColor: rgba(primary, 0.18),
            borderColor: primary,
            borderWidth: 2,
            pointBackgroundColor: primary,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 4,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            suggestedMin: 0,
            suggestedMax: 12,
            ticks: {
              stepSize: 3,
              color: mutedColor,
              backdropColor: 'transparent',
              font: { size: 10 },
            },
            grid: { color: gridColor },
            angleLines: { color: gridColor },
            pointLabels: {
              color: textColor,
              font: { size: 11 },
              padding: 8,
              callback: (label: string) => wrapLabel(label),
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed.r}`,
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

<figure class="chart-figure">
  <figcaption class="chart-figure__caption">Per-symptom Radar Plot</figcaption>
  <div class="chart-figure__canvas">
    <canvas
      bind:this={canvas}
      id={canvasId}
      aria-label="Radar chart showing severity scores for each of the ten MSI symptoms"
      role="img"
    ></canvas>
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
    max-width: 420px;
    aspect-ratio: 1 / 1;
  }
</style>
