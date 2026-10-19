/**
 * Props every survey accepts when embedded in a parent flow (a modal, the
 * patient walk-through, or an upload review) rather than run standalone.
 * Shared by the survey wrappers and `pain-classification/ChildSurvey`.
 */
export interface EmbeddedSurveyProps {
  /** Called after the survey scores and persists its result, instead of
   *  navigating to the standalone results page. */
  onComplete?: () => void;
  /** When supplied, render a back control beside the submit button. */
  onBack?: () => void;
  /** Label for the back control (e.g. "Previous test", "Back to review"). */
  backLabel?: string;
  submitLabel?: string;
  /** Optional Material Symbol rendered after the submit label. */
  submitIcon?: string;
  /** Hide the in-survey progress bar (e.g. when a parent shows it instead). */
  showProgress?: boolean;
  /** Bindable completion fraction (0–1), so an embedding parent can render it. */
  progress?: number;
  /** Pre-fill answers (e.g. from an uploaded sheet being confirmed). */
  initialAnswers?: Record<string, number>;
  /** Pre-fill the comments text. */
  initialComments?: string;
  /** The scanned comments region had ink: highlight the field (never blocks). */
  commentsDetected?: boolean;
  /** Answer keys the sheet read flagged for review; highlighted until resolved. */
  attentionKeys?: string[];
  /** Is this a review of an uploaded sheet (vs. taking/editing the test)?
   *  Shows the scan hints and skips the confirm step. Defaults to false. */
  review?: boolean;

  // FreBAQ only — ignored by surveys without a bothersome-area field.
  /** Pre-fill the bothersome-area text. */
  initialArea?: string;
  /** The scanned area region carried content: require and highlight it. */
  requireArea?: boolean;
  /** Zoomed crop of the scanned area handwriting, pinned beside the field. */
  areaCropUrl?: string;
  /** Correction-mark outcome for the area crop (drives the hint text). */
  areaCorrection?: 'cleaned' | 'unread';
}
