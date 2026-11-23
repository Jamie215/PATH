/**
 * Shared Chart.js setup. Registering controllers/elements/scales here
 * (rather than importing 'chart.js/auto' in each component) cuts the
 * bundle by ~50KB gzipped — we only ship the chart types we actually use.
 *
 * Currently used: radar (LineElement, PointElement, Filler, RadialLinearScale)
 * and bar (BarElement, LinearScale, CategoryScale).
 */
import {
  Chart,
  BarController,
  BarElement,
  RadarController,
  LineElement,
  PointElement,
  Filler,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

let registered = false;

export function ensureChartJsRegistered(): typeof Chart {
  if (!registered) {
    Chart.register(
      BarController,
      BarElement,
      RadarController,
      LineElement,
      PointElement,
      Filler,
      CategoryScale,
      LinearScale,
      RadialLinearScale,
      Tooltip,
      Legend,
    );
    registered = true;
  }
  return Chart;
}

/**
 * Read a design token (CSS custom property) so charts share the site palette.
 * Every page loads global.css, so the token is always defined; colors are
 * never restated here or in the chart components.
 */
export function cssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export { Chart };
