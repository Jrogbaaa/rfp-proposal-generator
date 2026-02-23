import type { ProposalData } from '../types/proposal';

const API_KEY = import.meta.env.VITE_PANDADOC_API_KEY;
const TEMPLATE_UUID = import.meta.env.VITE_PANDADOC_TEMPLATE_UUID;
const BASE_URL = '/api/pandadoc'; // Use Vite proxy

interface PandaDocResponse {
  id: string;
  name: string;
  status: string;
  date_created: string;
}

/**
 * Creates a proposal document in PandaDoc from a template
 */
export async function createProposal(data: ProposalData): Promise<{ documentId: string; internalLink: string }> {
  if (!TEMPLATE_UUID) {
    throw new Error('VITE_PANDADOC_TEMPLATE_UUID environment variable is not set');
  }

  const documentName = `${data.client.company} - ${data.project.title}`;

  const payload = {
    name: documentName,
    template_uuid: TEMPLATE_UUID,
    recipients: [
      {
        email: data.client.email,
        first_name: data.client.firstName,
        last_name: data.client.lastName,
        role: 'Client',
      },
    ],
    tokens: [
      { name: 'Client.FirstName', value: data.client.firstName },
      { name: 'Client.LastName', value: data.client.lastName },
      { name: 'Client.Email', value: data.client.email },
      { name: 'Client.Company', value: data.client.company },
      { name: 'Project.Title', value: data.project.title },
      { name: 'Project.Duration', value: data.project.duration },
      { name: 'Project.TotalValue', value: data.project.totalValue },
      { name: 'Project.PlatformCosts', value: data.project.platformCosts },
      { name: 'Project.MonthOneInvestment', value: data.project.monthOneInvestment },
      { name: 'Project.MonthTwoInvestment', value: data.project.monthTwoInvestment },
      { name: 'Project.MonthThreeInvestment', value: data.project.monthThreeInvestment },
      { name: 'Problem.1', value: data.content.problems[0] || '' },
      { name: 'Problem.2', value: data.content.problems[1] || '' },
      { name: 'Problem.3', value: data.content.problems[2] || '' },
      { name: 'Problem.4', value: data.content.problems[3] || '' },
      { name: 'Benefit.1', value: data.content.benefits[0] || '' },
      { name: 'Benefit.2', value: data.content.benefits[1] || '' },
      { name: 'Benefit.3', value: data.content.benefits[2] || '' },
      { name: 'Benefit.4', value: data.content.benefits[3] || '' },
      { name: 'ProblemExpansion.1', value: data.expanded.problemExpansions[0] || '' },
      { name: 'ProblemExpansion.2', value: data.expanded.problemExpansions[1] || '' },
      { name: 'ProblemExpansion.3', value: data.expanded.problemExpansions[2] || '' },
      { name: 'ProblemExpansion.4', value: data.expanded.problemExpansions[3] || '' },
      { name: 'BenefitExpansion.1', value: data.expanded.benefitExpansions[0] || '' },
      { name: 'BenefitExpansion.2', value: data.expanded.benefitExpansions[1] || '' },
      { name: 'BenefitExpansion.3', value: data.expanded.benefitExpansions[2] || '' },
      { name: 'BenefitExpansion.4', value: data.expanded.benefitExpansions[3] || '' },
      { name: 'Generated.SlideFooter', value: data.generated.slideFooter },
      { name: 'Generated.ContractFooterSlug', value: data.generated.contractFooterSlug },
      { name: 'Generated.CreatedDate', value: data.generated.createdDate },
    ],
    metadata: {
      source: 'proposify-demo',
      created_date: data.generated.createdDate,
    },
  };

  const response = await fetch(`${BASE_URL}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `API-Key ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[PandaDoc] API Error:', errorText);
    throw new Error(`PandaDoc API error: ${response.status} - ${errorText}`);
  }

  const result: PandaDocResponse = await response.json();

  // The internal link for editing
  const internalLink = `https://app.pandadoc.com/a/#/documents/${result.id}/content`;

  return {
    documentId: result.id,
    internalLink,
  };
}

export async function getDocumentStatus(documentId: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/documents/${documentId}`, {
    headers: {
      'Authorization': `API-Key ${API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get document status: ${response.status}`);
  }

  const result = await response.json();
  return result.status;
}
