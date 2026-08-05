/**
 * Registry of all assessments available on the hub.
 *
 * To add a new assessment:
 *   1. Create a folder under src/assessments/<slug>/ with its config/scoring
 *   2. Add an entry to this registry
 *   3. Add the assessment's pages/results components
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
  /**
   * When true, the assessment keeps its own page/route but is not shown as a
   * card on the hub home screen. Used for assessments that are only meant to
   * be reached as part of a composite (e.g. BriefSLANSS and PHQ-4, which are
   * children of Pain Classification).
   */
  hideFromHub?: boolean;
}

export const assessments: AssessmentSummary[] = [
  {
    slug: 'msi',
    title: 'Symptom Index',
    shortName: 'Symptom Index',
    description:
      'A ten-symptom screening that gathers frequency and bothersomeness ratings.',
    icon: 'body_system',
    status: 'available',
    estimatedMinutes: 10,
  },
  {
    slug: 'briefslanss',
    title: 'Sensory Profile',
    shortName: 'Sensory Profile',
    description:
      'A brief screening for neuropathic pain, with four symptom questions.',
    icon: 'neurology',
    status: 'available',
    estimatedMinutes: 2,
    hideFromHub: true,
  },
  {
    slug: 'frebaq',
    title: 'Body Awareness',
    shortName: 'Body Awareness',
    description:
      'A quantitative evaluation of area-specific self-perception.',
    icon: 'psychology_alt',
    status: 'available',
    estimatedMinutes: 4,
  },
  {
    slug: 'phq4',
    title: 'Anxiety & Depression',
    shortName: 'Anxiety & Depression',
    description:
      'A brief screening for depression and anxiety.',
    icon: 'stress_management',
    status: 'available',
    estimatedMinutes: 2,
    hideFromHub: true,
  },
  {
    slug: 'pain-classification',
    title: 'Pain Classification Assessment',
    shortName: 'Pain Classification',
    description:
      'Composite assessment that classifies pain presentation, with separate scoring for acute and chronic.',
    icon: 'personal_injury',
    status: 'available',
    estimatedMinutes: 30,
  },
];
