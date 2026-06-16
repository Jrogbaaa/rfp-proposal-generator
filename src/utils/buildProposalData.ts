import type { ProposalData, ExpandedContent } from '../types/proposal'

/**
 * Assembles a complete ProposalData from the parsed brief plus generated LLM
 * content, filling sensible defaults. Shared by the Google Slides and the
 * "Design with Claude" export paths.
 */
export function buildProposalData(
  parsedData: Partial<ProposalData>,
  llmContent?: ExpandedContent,
): ProposalData {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const company = parsedData.client?.company || ''

  return {
    client: {
      firstName: parsedData.client?.firstName || '',
      lastName: parsedData.client?.lastName || '',
      email: parsedData.client?.email || '',
      company,
      companyDomain: parsedData.client?.companyDomain || '',
    },
    project: {
      title: parsedData.project?.title || '',
      duration: parsedData.project?.duration || '',
      totalValue: parsedData.project?.totalValue || '',
      platformCosts: parsedData.project?.platformCosts || '',
      monthOneInvestment: parsedData.project?.monthOneInvestment || '',
      monthTwoInvestment: parsedData.project?.monthTwoInvestment || '',
      monthThreeInvestment: parsedData.project?.monthThreeInvestment || '',
    },
    content: parsedData.content || {
      problems: ['', '', '', ''],
      benefits: ['', '', '', ''],
    },
    expanded: llmContent || {
      problemExpansions: parsedData.content?.problems as [string, string, string, string] || ['', '', '', ''],
      benefitExpansions: parsedData.content?.benefits as [string, string, string, string] || ['', '', '', ''],
    },
    generated: {
      slideFooter: company ? `${company} | Confidential` : 'Confidential',
      contractFooterSlug: `proposal-${Date.now()}`,
      createdDate: today,
    },
  }
}
