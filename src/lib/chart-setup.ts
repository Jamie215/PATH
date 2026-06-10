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

export { Chart };
