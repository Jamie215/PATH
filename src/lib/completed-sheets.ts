/**
 * The patient's "completed tests" PDF: every Pain Classification child's
 * answer sheet in one fillable document, pre-filled with the answers stored so
 * far (no scores). Offered from the patient flow and its review page; the same
 * document can later be uploaded on the professional collection page.
 *
 * omr-sheet (pdf-lib) is lazy-imported so it only loads on download.
 */
import { get as storeGet } from './storage';
import { ACUTE_CHILDREN } from '../assessments/pain-classification/config';

export async function buildCompletedSheets(
  patientName = '',
): Promise<{ bytes: Uint8Array; filename: string }> {
  const { generateCombinedAnswerSheets, buildCombinedAnswerSheetFilename } = await import('./omr-sheet');
  const today = new Date().toLocaleDateString();
  const name = patientName.trim();
  const entries = ACUTE_CHILDREN.flatMap((c) => {
    if (!c.omrTemplate) return [];
    const response = storeGet<Record<string, number | string>>(`${c.slug}:response`) ?? {};
    return [
      {
        template: c.omrTemplate,
        answers: { ...response, patient_date: today, ...(name ? { patient_name: name } : {}) },
      },
    ];
  });
  return {
    bytes: await generateCombinedAnswerSheets(entries),
    filename: buildCombinedAnswerSheetFilename(),
  };
}
