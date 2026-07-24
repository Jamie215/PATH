/**
 * Builder for single-group OMR answer sheets — one row per item, one row of
 * mutually-exclusive bubbles per row (the shape of BriefSLANSS, FreBAQ, and
 * PHQ-4, unlike MSI's paired frequency/bothersomeness layout).
 *
 * Authored in PostScript points on US Letter, normalized on the way out, so
 * the generator and reader share one geometry. The bubble columns are
 * right-aligned, leaving a wide left column for the (often long) item text,
 * which the renderer wraps.
 */
import type { OmrTemplate, OmrRow } from './types';

const PAGE_W = 612;
const PAGE_H = 792;
const BUBBLE_RADIUS_PT = 5;
const FIDUCIAL_SIZE_PT = 16;
const FIDUCIAL_INSET = 30;

export interface SingleGroupItem {
  /** Response key the scorer expects, e.g. `numb_exp`. */
  key: string;
  label: string;
  description?: string;
}

export interface SingleGroupConfig {
  id: string;
  title: string;
  subtitle: string;
  instructions: string[];
  /** Heading over the answer columns, e.g. "How often?" */
  groupLabel: string;
  /** Short per-column headers (values or short words) aligned with `optionValues`. */
  optionHeaders: string[];
  /** The value each column encodes, left→right. */
  optionValues: number[];
  /** Decode lines for the columns (empty when the headers are self-explanatory). */
  legend: string[];
  /** Section heading over the item rows. */
  sectionTitle: string;
  items: SingleGroupItem[];
  /** Spacing between answer columns (pt). */
  colSpacing?: number;
  /** Center x of the rightmost column (pt). */
  lastColRightPt?: number;
  /** First row's bubble-center y (pt) and spacing between rows (pt). */
  firstRowY?: number;
  rowSpacing?: number;
}

const nx = (pt: number): number => pt / PAGE_W;
const ny = (pt: number): number => pt / PAGE_H;

export function buildSingleGroupTemplate(cfg: SingleGroupConfig): OmrTemplate {
  const colSpacing = cfg.colSpacing ?? 40;
  const lastCol = cfg.lastColRightPt ?? 540;
  const firstRowY = cfg.firstRowY ?? 320;
  const rowSpacing = cfg.rowSpacing ?? 44;
  const n = cfg.optionValues.length;

  // Right-aligned columns: leftmost = lastCol - (n-1)*spacing.
  const columnsXpt = cfg.optionValues.map((_, i) => lastCol - (n - 1 - i) * colSpacing);

  const rows: OmrRow[] = cfg.items.map((item, i): OmrRow => {
    const rowY = firstRowY + i * rowSpacing;
    return {
      label: item.label,
      description: item.description,
      fields: [
        {
          key: item.key,
          bubbles: cfg.optionValues.map((value, ci) => ({
            value,
            center: { x: nx(columnsXpt[ci]), y: ny(rowY) },
          })),
        },
      ],
    };
  });

  return {
    id: cfg.id,
    title: cfg.title,
    subtitle: cfg.subtitle,
    instructions: cfg.instructions,
    page: { width: PAGE_W, height: PAGE_H },
    bubbleRadius: nx(BUBBLE_RADIUS_PT),
    fiducialSize: nx(FIDUCIAL_SIZE_PT),
    fiducials: [
      { x: nx(FIDUCIAL_INSET), y: ny(FIDUCIAL_INSET) },
      { x: nx(PAGE_W - FIDUCIAL_INSET), y: ny(FIDUCIAL_INSET) },
      { x: nx(PAGE_W - FIDUCIAL_INSET), y: ny(PAGE_H - FIDUCIAL_INSET) },
      { x: nx(FIDUCIAL_INSET), y: ny(PAGE_H - FIDUCIAL_INSET) },
    ],
    orientationMark: {
      center: { x: nx(FIDUCIAL_INSET + 24), y: ny(PAGE_H - FIDUCIAL_INSET - 24) },
      size: nx(8),
    },
    sections: [
      {
        title: cfg.sectionTitle,
        legend: cfg.legend,
        columnGroups: [
          {
            label: cfg.groupLabel,
            optionHeaders: cfg.optionHeaders,
            columnX: columnsXpt.map(nx),
          },
        ],
        rows,
      },
    ],
  };
}
