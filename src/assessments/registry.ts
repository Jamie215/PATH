/**
 * Registry of all assessments available on the hub.
 *
 * This is the one place an assessment's name and description are written;
 * the composite's cards, the reports and the page titles read them from here
 * via `assessmentBySlug`.
 *
 * To add a single-total screener, see "Adding a screener" in README.md: its
 * folder, a definition, an entry in screeners.ts and an entry here. Other
 * kinds of assessment (like MSI) need their own pages and components too.
 *
 * `status: 'available'` means the assessment is fully implemented and
 * navigable from the hub. `status: 'planned'` shows a "coming soon" card.
 *
 * `icon` is the name of a Google Material Symbols Outlined icon.
 * Browse names at https://fonts.google.com/icons
 */

/** Who is filling in an assessment, chosen at intake. Patients never see
 *  scores; professionals see scores, flags and the classification. */
export type Role = 'patient' | 'professional';

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
      'Composite assessment that classifies pain presentation.',
    icon: 'personal_injury',
    status: 'available',
    estimatedMinutes: 30,
  },
];

/** The registry entry for `slug`. Throws on an unknown slug, so a typo fails
 *  the build or tests instead of showing a blank name. */
export function assessmentBySlug(slug: string): AssessmentSummary {
  const found = assessments.find((a) => a.slug === slug);
  if (!found) throw new Error(`Unknown assessment slug: ${slug}`);
  return found;
}
