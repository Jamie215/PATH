/**
 * Registry of all assessments available on the hub.
 *
 * To add a new assessment:
 *   1. Create a folder under src/assessments/<slug>/
 *   2. Add an entry to this registry
 *   3. (Later milestones) implement the assessment's config/scoring/results
 *
 * `status: 'available'` means the assessment is fully implemented and
 * navigable from the hub. `status: 'planned'` shows a "coming soon" card.
 *
 * `icon` is the name of a Google Material Symbols Outlined icon.
 * Browse names at https://fonts.google.com/icons
 */

export interface AssessmentSummary {
  slug: string;
  title: string;
  shortName: string;
  description: string;
  icon: string;
  status: 'available' | 'planned';
  estimatedMinutes?: number;
}

export const assessments: AssessmentSummary[] = [
  {
    slug: 'msi',
    title: 'Multi-Dimensional Symptom Index (MSI)',
    shortName: 'MSI',
    description:
      'A ten-symptom screening that gathers frequency and bothersomeness ratings.',
    icon: 'body_system',
    status: 'available',
    estimatedMinutes: 5,
  },
  {
    slug: 'pain-classification',
    title: 'Pain Classification Assessment',
    shortName: 'Pain Classification',
    description:
      'Composite assessment that classifies pain presentation, with separate scoring for acute and chronic.',
    icon: 'personal_injury',
    status: 'planned',
    estimatedMinutes: 15,
  },
];
