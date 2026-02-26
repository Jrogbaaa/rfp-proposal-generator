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

export interface ExpandedContent {
  problemExpansions: [string, string, string, string];
  benefitExpansions: [string, string, string, string];
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

export type Step = 'draft' | 'iterate' | 'design' | 'share';

export const STEPS: { id: Step; label: string; number: number }[] = [
  { id: 'draft', label: 'Draft', number: 1 },
  { id: 'iterate', label: 'Iteration', number: 2 },
  { id: 'design', label: 'Design', number: 3 },
  { id: 'share', label: 'Share', number: 4 },
];
