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

export type Step = 'input' | 'expand' | 'review' | 'success';

export const STEPS: { id: Step; label: string; number: number }[] = [
  { id: 'input', label: 'Client Info', number: 1 },
  { id: 'expand', label: 'Content', number: 2 },
  { id: 'review', label: 'Review', number: 3 },
  { id: 'success', label: 'Complete', number: 4 },
];
