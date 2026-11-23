/**
 * Page frame shared by every OMR answer sheet: US Letter in PostScript points,
 * the bubble size, and the four corner fiducials plus orientation mark the
 * scan reader registers against. Templates author their layout in points and
 * normalize it with `nx`/`ny`, so the printed sheet and the reader share one
 * geometry. Changing anything here moves every sheet — re-run the OMR tests.
 */
import type { OmrTemplate } from './types';

export const PAGE_W = 612;
export const PAGE_H = 792;

/** Bubble radius. Small, so a quick firm pen mark fills most of it. */
const BUBBLE_RADIUS_PT = 5;
const FIDUCIAL_SIZE_PT = 16;
/** Fiducial center inset from each page edge. */
const FIDUCIAL_INSET = 30;

/** Points → normalized page coordinates (x by width, y by height). */
export const nx = (pt: number): number => pt / PAGE_W;
export const ny = (pt: number): number => pt / PAGE_H;

/** The template fields every sheet shares: page, bubble size, registration marks. */
export function sheetFrame(): Pick<
  OmrTemplate,
  'page' | 'bubbleRadius' | 'fiducialSize' | 'fiducials' | 'orientationMark'
> {
  return {
    page: { width: PAGE_W, height: PAGE_H },
    bubbleRadius: nx(BUBBLE_RADIUS_PT),
    fiducialSize: nx(FIDUCIAL_SIZE_PT),
    fiducials: [
      { x: nx(FIDUCIAL_INSET), y: ny(FIDUCIAL_INSET) }, // TL
      { x: nx(PAGE_W - FIDUCIAL_INSET), y: ny(FIDUCIAL_INSET) }, // TR
      { x: nx(PAGE_W - FIDUCIAL_INSET), y: ny(PAGE_H - FIDUCIAL_INSET) }, // BR
      { x: nx(FIDUCIAL_INSET), y: ny(PAGE_H - FIDUCIAL_INSET) }, // BL
    ],
    // Inset diagonally from the bottom-left corner — empty space clear of any
    // header/footer text, next to exactly one fiducial, so the reader can name
    // that corner and recover the sheet's orientation.
    orientationMark: {
      center: { x: nx(FIDUCIAL_INSET + 24), y: ny(PAGE_H - FIDUCIAL_INSET - 24) },
      size: nx(8),
    },
  };
}
