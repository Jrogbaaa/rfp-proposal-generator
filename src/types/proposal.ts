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

export interface ExpandedContent {
  problemExpansions: [string, string, string, string];
  benefitExpansions: [string, string, string, string];
  additionalSlides?: AdditionalSlide[];
  customTitles?: Record<number, string>;
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

export type ColorTheme = 'navy-gold' | 'slate-blue' | 'forest-green';

export interface DesignConfig {
  colorTheme: ColorTheme;
}

export const DEFAULT_DESIGN_CONFIG: DesignConfig = {
  colorTheme: 'navy-gold',
};
