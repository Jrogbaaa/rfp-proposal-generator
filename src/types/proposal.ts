export interface ClientInfo {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  companyDomain?: string;
}

export interface ProjectInfo {
  title: string;
  duration: string;
  totalValue: string;
  platformCosts: string;
  monthOneInvestment: string;
  monthTwoInvestment: string;
  monthThreeInvestment: string;
}

export interface ProblemsAndBenefits {
  problems: [string, string, string, string];
  benefits: [string, string, string, string];
}

export interface AdditionalSlide {
  title: string;
  bullets: string[];
}

// Paramount media sales types — used in the Dunkin-style deck output
export interface IPAlignment {
  propertyName: string;   // e.g. "Big Brother S28", "VMAs 2026"
  description: string;    // 1-2 sentences on why this property fits the brand
  audienceStat: string;   // e.g. "6.8M avg viewers, 61% female, 54% Gen Z"
  network: string;        // e.g. "CBS", "Paramount+", "MTV"
}

export interface IntegrationConcept {
  conceptTitle: string;   // e.g. "Big Brother Breakfast Rewards Mechanic"
  property: string;       // named Paramount property
  mechanic: string;       // 2-3 sentences describing the specific integration
  outcome: string;        // measurable business outcome
}

export interface CalendarItem {
  tentpole: string;       // e.g. "68th GRAMMY Awards"
  date: string;           // e.g. "February 2, 2026"
  reach: string;          // e.g. "20M+ viewers"
  opportunity: string;    // 1 sentence on what the brand could own
}

export interface InvestmentTier {
  tierName: string;       // e.g. "Core", "Enhanced", "Signature"
  budget: string;         // e.g. "$5M–$8M"
  inclusions: string[];   // 3-5 bullet points of what's included
}

export interface ParamountMediaContent {
  opportunityStatement: string;
  paramountIPAlignments: IPAlignment[];
  audienceInsights: string[];
  integrationConcepts: IntegrationConcept[];
  talentOpportunities: string[];
  programmingCalendar: CalendarItem[];
  measurementFramework: string[];
  investmentTiers: InvestmentTier[];
  nextSteps: string[];
  appendixItems: string[];
}

export interface ExpandedContent {
  problemExpansions: [string, string, string, string];
  benefitExpansions: [string, string, string, string];
  approachSteps?: string[];   // 3-4 methodology step descriptions (LLM-generated)
  nextSteps?: string[];       // 3-5 post-agreement action items (LLM-generated)
  additionalSlides?: AdditionalSlide[];
  customTitles?: Record<number, string>;
  // User edits from the Refine tab (slides 1 & 2)
  editedProjectTitle?: string;
  editedProblems?: [string, string, string, string];
  editedBenefits?: [string, string, string, string];
  // Paramount media sales content (Dunkin-style deck)
  paramountMedia?: ParamountMediaContent;
}

export interface GeneratedContent {
  slideFooter: string;
  contractFooterSlug: string;
  createdDate: string;
}

export interface ProposalData {
  client: ClientInfo;
  project: ProjectInfo;
  content: ProblemsAndBenefits;
  expanded: ExpandedContent;
  generated: GeneratedContent;
}

export interface ProposalState {
  step: number;
  inputMode: 'structured' | 'transcript' | null;
  client: ClientInfo;
  project: ProjectInfo;
  content: ProblemsAndBenefits;
  expanded: ExpandedContent;
  generated: GeneratedContent;
  isLoading: boolean;
  error: string | null;
}

export type Step = 'draft' | 'iterate' | 'share';

export const STEPS: { id: Step; label: string; number: number }[] = [
  { id: 'draft', label: 'Draft', number: 1 },
  { id: 'iterate', label: 'Refine', number: 2 },
  { id: 'share', label: 'Export', number: 3 },
];

export type ColorTheme = 'navy-gold' | 'slate-blue' | 'forest-green' | 'executive-dark' | 'paramount';

// Controls slide layout variant (Option 2 / Option 3)
// 'standard'           — original layout (default)
// 'bold-agency'        — dramatic layouts: dark challenge slides, split solution panel, corner ellipses on close
// 'executive-minimal'  — all-dark slides, hairline rules, premium consulting feel
export type DesignStyle = 'standard' | 'bold-agency' | 'executive-minimal';

export interface DesignConfig {
  colorTheme: ColorTheme;
  designStyle?: DesignStyle;
  disableBrandDetection?: boolean; // set true to override auto brand color detection
  customBrandHex?: string;         // user-supplied hex e.g. "#FF6600" — takes priority over auto-detection
}

// Structured brand voice profile — extracted from example PDFs
export interface BrandVoiceProfile {
  tone: string[];              // e.g. ["authoritative", "direct", "data-driven"]
  sentenceStyle: string;       // e.g. "Short punchy statements. Lead with outcome."
  perspective: string;         // e.g. "Second-person 'you' focus"
  forbiddenPhrases: string[];  // hedging words/phrases to avoid
  preferredVocabulary: string[]; // power words and brand-specific terms to use
  ctaStyle: string;            // how CTAs and closing statements are written
  proseSummary: string;        // 2-3 sentence human-readable summary for display
}

export const DEFAULT_DESIGN_CONFIG: DesignConfig = {
  colorTheme: 'navy-gold',
  designStyle: 'standard',
};
