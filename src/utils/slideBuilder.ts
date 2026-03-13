import type { ProposalData } from '../types/proposal'
import type { SlideData } from '../data/slideContent'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

const MAX_EXPANSION_CHARS = 350
const MAX_BULLETS = 5
const MAX_BULLET_CHARS = 120
const MAX_STEPS = 6
const MAX_STEP_CHARS = 100

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…'
}

function capBullets(items: string[], maxItems: number, maxChars: number): string[] {
  return items.slice(0, maxItems).map(b => truncate(b, maxChars))
}

export function buildSlidesFromData(data: Partial<ProposalData>): SlideData[] {
  const client = data.client
  const project = data.project
  const content = data.content
  const expanded = data.expanded

  // Route to flexible slide builders for non-RFP deck types
  if (expanded?.deckType === 'paramount-showcase' && expanded.showcaseContent) {
    const sc = expanded.showcaseContent
    const slides: SlideData[] = []
    let slideNum = 1
    // Cover slide
    slides.push({
      slideNumber: slideNum++,
      slideKey: 'title',
      editable: false,
      type: 'title',
      title: sc.showcaseTitle,
      subtitle: sc.executiveSummary,
      bullets: [],
    })
    // Content slides from LLM-defined sequence
    sc.slides.forEach(s => {
      slides.push({
        slideNumber: slideNum++,
        slideKey: s.slideKey,
        editable: true,
        type: 'content',
        title: s.title,
        subtitle: s.subtitle,
        bullets: capBullets(s.bullets, MAX_BULLETS, MAX_BULLET_CHARS),
      })
    })
    // Audience insights slide if present
    if (sc.audienceInsights && sc.audienceInsights.length > 0) {
      slides.push({
        slideNumber: slideNum++,
        slideKey: 'audience_insights',
        editable: true,
        type: 'content',
        title: 'Audience Insights',
        subtitle: 'Paramount reach & demographics',
        bullets: capBullets(sc.audienceInsights, MAX_BULLETS, MAX_BULLET_CHARS),
      })
    }
    // Measurement slide if present
    if (sc.measurementFramework && sc.measurementFramework.length > 0) {
      slides.push({
        slideNumber: slideNum++,
        slideKey: 'measurement',
        editable: true,
        type: 'content',
        title: 'Measurement Framework',
        subtitle: undefined,
        bullets: capBullets(sc.measurementFramework, MAX_BULLETS, MAX_BULLET_CHARS),
      })
    }
    // Append any user-added additional slides
    ;(expanded.additionalSlides ?? []).forEach((s, i) => {
      slides.push({
        slideNumber: slideNum++,
        slideKey: `additional_${i}`,
        editable: true,
        type: 'content',
        title: s.title,
        subtitle: undefined,
        bullets: capBullets(s.bullets, MAX_BULLETS, MAX_BULLET_CHARS),
      })
    })
    return slides
  }

  if (expanded?.deckType === 'generic' && expanded.flexibleSlides) {
    const slides: SlideData[] = []
    let slideNum = 1
    // Cover slide from project/request context
    const title = project?.title || (expanded.flexibleSlides[0]?.title ?? 'Presentation')
    slides.push({
      slideNumber: slideNum++,
      slideKey: 'title',
      editable: false,
      type: 'title',
      title,
      subtitle: client?.company ? `Prepared for ${client.company}` : undefined,
      bullets: [],
    })
    // Content slides from LLM-defined sequence
    expanded.flexibleSlides.forEach(s => {
      slides.push({
        slideNumber: slideNum++,
        slideKey: s.slideKey,
        editable: true,
        type: 'content',
        title: s.title,
        subtitle: s.subtitle,
        bullets: capBullets(s.bullets, MAX_BULLETS, MAX_BULLET_CHARS),
      })
    })
    // Append any user-added additional slides
    ;(expanded.additionalSlides ?? []).forEach((s, i) => {
      slides.push({
        slideNumber: slideNum++,
        slideKey: `additional_${i}`,
        editable: true,
        type: 'content',
        title: s.title,
        subtitle: undefined,
        bullets: capBullets(s.bullets, MAX_BULLETS, MAX_BULLET_CHARS),
      })
    })
    return slides
  }

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
      ? capBullets(problems.filter(Boolean), MAX_BULLETS, MAX_BULLET_CHARS)
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
    bullets: problemExpansions ? [truncate(problemExpansions[0], MAX_EXPANSION_CHARS)].filter(Boolean) : [],
  })

  // Slide 4: Problem 2 deep dive
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'prob2',
    editable: true,
    type: 'content',
    title: customTitles['prob2'] ?? problems[1] ?? 'Challenge 02',
    subtitle: undefined,
    bullets: problemExpansions ? [truncate(problemExpansions[1], MAX_EXPANSION_CHARS)].filter(Boolean) : [],
  })

  // Slide 5: Problems 3 & 4 — only if at least one exists (mirrors export behaviour)
  if (problems[2] || problems[3]) {
    slides.push({
      slideNumber: slideNum++,
      slideKey: 'prob34',
      editable: true,
      type: 'content',
      title: 'Challenges 3 & 4',
      subtitle: undefined,
      bullets: capBullets([
        problems[2] || '',
        problemExpansions?.[2] || '',
        problems[3] || '',
        problemExpansions?.[3] || '',
      ].filter(Boolean), MAX_BULLETS, MAX_EXPANSION_CHARS),
    })
  }

  // Slide 6: Our Solution
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'solution',
    editable: true,
    type: 'content',
    title: 'Our Solution',
    subtitle: company !== '—' ? `How we deliver results for ${company}` : undefined,
    bullets: activeBenefitCount > 0
      ? capBullets(benefits.filter(Boolean), MAX_BULLETS, MAX_BULLET_CHARS)
      : ['Awaiting brief content'],
  })

  // Our Approach — conditional (only when approachSteps generated, mirrors export)
  if (approachSteps.length > 0) {
    slides.push({
      slideNumber: slideNum++,
      slideKey: 'approach',
      editable: true,
      type: 'content',
      title: 'Our Approach',
      subtitle: 'How We Deliver',
      bullets: capBullets(
        approachSteps.map((step, i) => `${pad(i + 1)}  ${step}`),
        MAX_STEPS, MAX_STEP_CHARS,
      ),
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
    bullets: benefitExpansions ? [truncate(benefitExpansions[0], MAX_EXPANSION_CHARS)].filter(Boolean) : [],
  })

  // Benefit 2 deep dive
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'ben2',
    editable: true,
    type: 'content',
    title: customTitles['ben2'] ?? benefits[1] ?? 'Outcome 02',
    subtitle: undefined,
    bullets: benefitExpansions ? [truncate(benefitExpansions[1], MAX_EXPANSION_CHARS)].filter(Boolean) : [],
  })

  // Benefits 3 & 4 — only if at least one exists (mirrors export behaviour)
  if (benefits[2] || benefits[3]) {
    slides.push({
      slideNumber: slideNum++,
      slideKey: 'ben34',
      editable: true,
      type: 'content',
      title: 'Benefits 3 & 4',
      subtitle: undefined,
      bullets: capBullets([
        benefits[2] || '',
        benefitExpansions?.[2] || '',
        benefits[3] || '',
        benefitExpansions?.[3] || '',
      ].filter(Boolean), MAX_BULLETS, MAX_EXPANSION_CHARS),
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
      editable: true,
      type: 'content',
      title: 'Next Steps',
      subtitle: 'What happens next',
      bullets: capBullets(
        nextSteps.map((step, i) => `${pad(i + 1)}  ${step}`),
        MAX_STEPS, MAX_STEP_CHARS,
      ),
    })
  }

  // Closing
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'closing',
    editable: true,
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
      bullets: capBullets(s.bullets, MAX_BULLETS, MAX_BULLET_CHARS),
    })
  })

  return slides
}
