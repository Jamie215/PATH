/**
 * MSI scoring matrix.
 *
 * Rows: frequency_index (0 = Never; 1-4 = Rarely × Barely/Noticeable/Quite/Stop;
 *   5-8 = Often × same; 9-12 = Always × same).
 * Columns: symptom_index (0=Sharp, 1=Dull, 2=Stiff, 3=Weak, 4=Sensitive,
 *   5=Numb, 6=Fatigue, 7=Foggy, 8=Nausea, 9=Anxiety).
 *
 * Values map (frequency, interference) to a normalized 0-12 score per symptom.
 * Ported verbatim from matrix.csv to preserve scoring fidelity with the
 * original Python implementation.
 */
export const MATRIX: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 0:  Never
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // 1:  Rarely, Barely
  [3, 4, 4, 4, 4, 4, 4, 4, 4, 3], // 2:  Rarely, Noticeable
  [6, 7, 7, 7, 6, 6, 6, 6, 6, 7], // 3:  Rarely, Quite
  [8, 8, 8, 8, 8, 8, 8, 7, 7, 8], // 4:  Rarely, Stop
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 5:  Often, Barely
  [5, 6, 5, 5, 5, 5, 5, 5, 5, 5], // 6:  Often, Noticeable
  [9, 9, 9, 9, 9, 9, 9, 9, 9, 9], // 7:  Often, Quite
  [10, 11, 10, 10, 11, 11, 11, 11, 10, 11], // 8:  Often, Stop
  [4, 3, 3, 3, 3, 3, 3, 3, 3, 4], // 9:  Always, Barely
  [7, 5, 6, 6, 7, 7, 7, 8, 8, 6], // 10: Always, Noticeable
  [11, 10, 11, 11, 10, 10, 10, 10, 11, 10], // 11: Always, Quite
  [12, 12, 12, 12, 12, 12, 12, 12, 12, 12], // 12: Always, Stop
];
