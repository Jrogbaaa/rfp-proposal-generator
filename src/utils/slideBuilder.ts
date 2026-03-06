import type { ProposalData } from '../types/proposal'
import type { SlideData } from '../data/slideContent'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function buildSlidesFromData(data: Partial<ProposalData>): SlideData[] {
  const client = data.client
  const project = data.project
  const content = data.content
  const expanded = data.expanded

  const company = client?.company || '—'
  const projectTitle = expanded?.editedProjectTitle ?? project?.title ?? '—'
  const problems = (expanded?.editedProblems ?? content?.problems ?? ['', '', '', '']) as string[]
  const benefits = (expanded?.editedBenefits ?? content?.benefits ?? ['', '', '', '']) as string[]
  const problemExpansions = expanded?.problemExpansions
  const benefitExpansions = expanded?.benefitExpansions
  const approachSteps = expanded?.approachSteps ?? []
  const nextSteps = expanded?.nextSteps ?? []
  const customTitles = expanded?.customTitles ?? {}
  const additionalSlides = expanded?.additionalSlides ?? []

  const activeProblemCount = problems.filter(Boolean).length
  const activeBenefitCount = benefits.filter(Boolean).length

  console.log('[slideBuilder] DEBUG', {
    benefits2: benefits[2],
    benefits3: benefits[3],
    approachSteps: approachSteps,
    nextSteps: nextSteps,
    expandedKeys: expanded ? Object.keys(expanded) : 'no expanded',
    contentBenefits: content?.benefits,
  })

  const slides: SlideData[] = []
  let slideNum = 1

  // Slide 1: Cover
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'title',
    editable: true,
    type: 'title',
    title: projectTitle,
    subtitle: company !== '—' ? `A Proposal for ${company}` : '',
    bullets: [
      company !== '—' ? `${company}${project?.duration ? ` · ${project.duration}` : ''}` : '',
      project?.totalValue ? `Investment: ${project.totalValue}` : '',
    ].filter(Boolean),
  })

  // Slide 2: The Challenge
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'challenge',
    editable: true,
    type: 'content',
    title: 'The Challenge',
    subtitle: company !== '—' ? `What's holding ${company} back` : undefined,
    bullets: activeProblemCount > 0
      ? problems.filter(Boolean)
      : ['Awaiting brief content'],
  })

  // Slide 3: Problem 1 deep dive
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'prob1',
    editable: true,
    type: 'content',
    title: customTitles['prob1'] ?? problems[0] ?? 'Challenge 01',
    subtitle: undefined,
    bullets: problemExpansions ? [problemExpansions[0]].filter(Boolean) : [],
  })

  // Slide 4: Problem 2 deep dive
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'prob2',
    editable: true,
    type: 'content',
    title: customTitles['prob2'] ?? problems[1] ?? 'Challenge 02',
    subtitle: undefined,
    bullets: problemExpansions ? [problemExpansions[1]].filter(Boolean) : [],
  })

  // Slide 5: Problems 3 & 4 — only if at least one exists (mirrors export behaviour)
  if (problems[2] || problems[3]) {
    slides.push({
      slideNumber: slideNum++,
      slideKey: 'prob34',
      editable: false,
      type: 'content',
      title: 'Challenges 3 & 4',
      subtitle: undefined,
      bullets: [
        problems[2] || '',
        problemExpansions?.[2] || '',
        problems[3] || '',
        problemExpansions?.[3] || '',
      ].filter(Boolean),
    })
  }

  // Slide 6: Our Solution
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'solution',
    editable: false,
    type: 'content',
    title: 'Our Solution',
    subtitle: company !== '—' ? `How we deliver results for ${company}` : undefined,
    bullets: activeBenefitCount > 0
      ? benefits.filter(Boolean)
      : ['Awaiting brief content'],
  })

  // Our Approach — conditional (only when approachSteps generated, mirrors export)
  if (approachSteps.length > 0) {
    slides.push({
      slideNumber: slideNum++,
      slideKey: 'approach',
      editable: false,
      type: 'content',
      title: 'Our Approach',
      subtitle: 'How We Deliver',
      bullets: approachSteps.map((step, i) => `${pad(i + 1)}  ${step}`),
    })
  }

  // Benefit 1 deep dive
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'ben1',
    editable: true,
    type: 'content',
    title: customTitles['ben1'] ?? benefits[0] ?? 'Outcome 01',
    subtitle: undefined,
    bullets: benefitExpansions ? [benefitExpansions[0]].filter(Boolean) : [],
  })

  // Benefit 2 deep dive
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'ben2',
    editable: true,
    type: 'content',
    title: customTitles['ben2'] ?? benefits[1] ?? 'Outcome 02',
    subtitle: undefined,
    bullets: benefitExpansions ? [benefitExpansions[1]].filter(Boolean) : [],
  })

  // Benefits 3 & 4 — only if at least one exists (mirrors export behaviour)
  if (benefits[2] || benefits[3]) {
    slides.push({
      slideNumber: slideNum++,
      slideKey: 'ben34',
      editable: false,
      type: 'content',
      title: 'Benefits 3 & 4',
      subtitle: undefined,
      bullets: [
        benefits[2] || '',
        benefitExpansions?.[2] || '',
        benefits[3] || '',
        benefitExpansions?.[3] || '',
      ].filter(Boolean),
    })
  }

  // Investment & Timeline
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'investment',
    editable: false,
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
  })

  // Next Steps — conditional (only when nextSteps generated, mirrors export)
  if (nextSteps.length > 0) {
    slides.push({
      slideNumber: slideNum++,
      slideKey: 'nextSteps',
      editable: false,
      type: 'content',
      title: 'Next Steps',
      subtitle: 'What happens next',
      bullets: nextSteps.map((step, i) => `${pad(i + 1)}  ${step}`),
    })
  }

  // Closing
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'closing',
    editable: false,
    type: 'closing',
    title: `Let's Build This Together`,
    subtitle: company !== '—' ? company : undefined,
    bullets: [
      `We look forward to building this together.`,
      client?.email ? `Reach us at ${client.email}` : '',
    ].filter(Boolean),
  })

  // Additional user-added slides
  additionalSlides.forEach((s, i) => {
    const key = `additional_${i}`
    slides.push({
      slideNumber: slideNum++,
      slideKey: key,
      editable: true,
      type: 'content',
      title: customTitles[key] ?? s.title,
      subtitle: undefined,
      bullets: s.bullets,
    })
  })

  return slides
}
