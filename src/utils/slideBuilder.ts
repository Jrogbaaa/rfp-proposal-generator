import type { ProposalData } from '../types/proposal'
import type { SlideData } from '../data/slideContent'

export function buildSlidesFromData(data: Partial<ProposalData>): SlideData[] {
  const client = data.client
  const project = data.project
  const content = data.content
  const expanded = data.expanded

  const company = client?.company || '—'
  const projectTitle = project?.title || '—'
  const problems = content?.problems || ['', '', '', '']
  const benefits = content?.benefits || ['', '', '', '']
  const problemExpansions = expanded?.problemExpansions
  const benefitExpansions = expanded?.benefitExpansions

  const activeProblemCount = problems.filter(Boolean).length
  const activeBenefitCount = benefits.filter(Boolean).length

  return [
    {
      slideNumber: 1,
      type: 'title',
      title: projectTitle,
      subtitle: client?.firstName
        ? `Presented to ${client.firstName} ${client.lastName}`.trim()
        : company !== '—' ? `Presented to ${company}` : '',
      bullets: [
        company !== '—' ? `${company}${project?.duration ? ` · ${project.duration}` : ''}` : '',
        project?.totalValue ? `Investment: ${project.totalValue}` : '',
      ].filter(Boolean),
    },
    {
      slideNumber: 2,
      type: 'content',
      title: 'The Challenge',
      subtitle: company !== '—' ? `What's holding ${company} back` : undefined,
      bullets: activeProblemCount > 0
        ? problems.filter(Boolean)
        : ['Awaiting brief content'],
    },
    {
      slideNumber: 3,
      type: 'content',
      title: problems[0] || 'Challenge',
      subtitle: undefined,
      bullets: problemExpansions
        ? [problemExpansions[0]].filter(Boolean)
        : ['Awaiting AI generation'],
    },
    {
      slideNumber: 4,
      type: 'content',
      title: problems[1] || 'Challenge',
      subtitle: undefined,
      bullets: problemExpansions
        ? [problemExpansions[1]].filter(Boolean)
        : ['Awaiting AI generation'],
    },
    {
      slideNumber: 5,
      type: 'content',
      title: 'Challenges 3 & 4',
      subtitle: undefined,
      bullets: [
        problems[2] || '',
        problemExpansions?.[2] || '',
        problems[3] || '',
        problemExpansions?.[3] || '',
      ].filter(Boolean),
    },
    {
      slideNumber: 6,
      type: 'content',
      title: 'Our Solution',
      subtitle: company !== '—' ? `How we deliver results for ${company}` : undefined,
      bullets: activeBenefitCount > 0
        ? benefits.filter(Boolean)
        : ['Awaiting brief content'],
    },
    {
      slideNumber: 7,
      type: 'content',
      title: benefits[0] || 'Outcome',
      subtitle: undefined,
      bullets: benefitExpansions
        ? [benefitExpansions[0]].filter(Boolean)
        : ['Awaiting AI generation'],
    },
    {
      slideNumber: 8,
      type: 'content',
      title: benefits[1] || 'Outcome',
      subtitle: undefined,
      bullets: benefitExpansions
        ? [benefitExpansions[1]].filter(Boolean)
        : ['Awaiting AI generation'],
    },
    {
      slideNumber: 9,
      type: 'content',
      title: 'Investment & Timeline',
      subtitle: undefined,
      bullets: [
        project?.totalValue ? `Total Investment: ${project.totalValue}` : '',
        project?.duration ? `Timeline: ${project.duration}` : '',
        project?.monthOneInvestment ? `Month 1: ${project.monthOneInvestment}` : '',
        project?.monthTwoInvestment ? `Month 2: ${project.monthTwoInvestment}` : '',
        project?.monthThreeInvestment ? `Month 3: ${project.monthThreeInvestment}` : '',
      ].filter(Boolean),
    },
    {
      slideNumber: 10,
      type: 'closing',
      title: `Let's Build This Together`,
      subtitle: company !== '—' ? company : undefined,
      bullets: [
        client?.firstName ? `Ready to move forward, ${client.firstName}?` : '',
        client?.email ? `Reach us at ${client.email}` : '',
      ].filter(Boolean),
    },
  ]
}
