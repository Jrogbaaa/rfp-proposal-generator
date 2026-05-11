import type { ProposalData } from '../types/proposal'
import type { SlideData } from '../data/slideContent'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

const MAX_BULLETS = 8
const MAX_BULLET_CHARS = 300
const MAX_STEPS = 6
const MAX_STEP_CHARS = 250

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
  const expanded = data.expanded

  const customTitlesAll = expanded?.customTitles ?? {}

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
        title: customTitlesAll['audience_insights'] ?? 'Audience Insights',
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
        title: customTitlesAll['measurement'] ?? 'Measurement Framework',
        subtitle: undefined,
        bullets: capBullets(sc.measurementFramework, MAX_BULLETS, MAX_BULLET_CHARS),
      })
    }
    // Append any user-added additional slides
    ;(expanded.additionalSlides ?? []).forEach((s, i) => {
      const key = `additional_${i}`
      slides.push({
        slideNumber: slideNum++,
        slideKey: key,
        editable: true,
        type: 'content',
        title: customTitlesAll[key] ?? s.title,
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
    const title = expanded.editedProjectTitle ?? project?.title ?? (expanded.flexibleSlides[0]?.title ?? 'Presentation')
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
      const key = `additional_${i}`
      slides.push({
        slideNumber: slideNum++,
        slideKey: key,
        editable: true,
        type: 'content',
        title: customTitlesAll[key] ?? s.title,
        subtitle: undefined,
        bullets: capBullets(s.bullets, MAX_BULLETS, MAX_BULLET_CHARS),
      })
    })
    return slides
  }

  const company = client?.company || '—'
  const projectTitle = expanded?.editedProjectTitle ?? project?.title ?? '—'
  const nextSteps = expanded?.nextSteps ?? []
  const approachSteps = expanded?.approachSteps ?? []
  const customTitles = expanded?.customTitles ?? {}
  const additionalSlides = expanded?.additionalSlides ?? []

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
    mainIdea: 'Sets the stage — who this proposal is for and what\'s at stake.',
  })

  // Slide 2: The New Reality of Attention (Cultural Shift)
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'cultural_shift',
    editable: true,
    type: 'content',
    title: 'The New Reality of Attention',
    subtitle: company !== '—' ? `${company} · The Attention Crisis` : undefined,
    bullets: expanded?.culturalShift?.length
      ? capBullets(expanded.culturalShift, MAX_BULLETS, MAX_BULLET_CHARS)
      : ['Media is fragmenting across TikTok, streaming, and fan communities',
         'Gen Z lives in culture, not channels — if your brand isn\'t part of it, you\'re invisible',
         'Traditional reach metrics mask a deeper problem: attention ≠ engagement'],
    mainIdea: 'Frames the market reality your prospect is operating in.',
  })

  // Slide 3: Why Most Brand Campaigns Fail Today (Real Problem)
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'real_problem',
    editable: true,
    type: 'content',
    title: 'Why Most Brand Campaigns Fail Today',
    subtitle: 'The Reframe',
    bullets: expanded?.realProblem?.length
      ? capBullets(expanded.realProblem, MAX_BULLETS, MAX_BULLET_CHARS)
      : ['Interruptive ads don\'t create impact — they create skip buttons',
         'Media spend ≠ cultural relevance. Presence ≠ remembrance.',
         'Brands are buying impressions but not earning attention'],
    mainIdea: 'Diagnoses why current approaches are failing.',
  })

  // Slide 4: What This Is Costing You (Cost of Inaction)
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'cost_of_inaction',
    editable: true,
    type: 'content',
    title: 'What This Is Costing You',
    subtitle: undefined,
    bullets: expanded?.costOfInaction?.length
      ? capBullets(expanded.costOfInaction, MAX_BULLETS, MAX_BULLET_CHARS)
      : ['Lost attention — your ads play but nobody remembers',
         'Low brand recall — declining ROI on traditional media',
         'Weak emotional connection — no cultural currency with Gen Z'],
    mainIdea: 'Makes the cost of doing nothing concrete and urgent.',
  })

  // Slide 5: The Core Insight (Money Slide)
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'core_insight',
    editable: true,
    type: 'impact',
    title: expanded?.coreInsight ?? 'Winning Brands Don\'t Buy Media — They Join Culture',
    subtitle: 'The Core Insight',
    bullets: [
      'Big Brother integrations — brand becomes part of the content',
      'VMAs moments — shoppable, social-first, in the cultural conversation',
      'Talent + fandom + live moments = emotional brand equity at scale',
    ],
    mainIdea: 'The pivot — your single most important strategic idea.',
  })

  // Slide 6: How Paramount Turns Brands Into Cultural Moments
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'paramount_advantage',
    editable: true,
    type: 'content',
    title: 'How Paramount Turns Brands Into Cultural Moments',
    subtitle: company !== '—' ? `${company} × Paramount` : undefined,
    mainIdea: 'Shows how the offering uniquely solves the problem.',
    bullets: [
      'IP: Big Brother, VMAs, NFL, GRAMMYs — culture\'s biggest stages',
      'Talent: Named partnerships that drive authentic brand connections',
      'Multi-platform: CBS + Paramount+ + MTV + BET + social',
      'Integration formats: Not ads — native content, shoppable moments, fan activations',
    ],
  })

  // Slide 7: Proven Impact at Scale (Proof)
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'proof',
    editable: true,
    type: 'impact',
    title: 'Proven Impact at Scale',
    subtitle: 'When brands integrate into culture — this happens',
    bullets: expanded?.proofPoints?.length
      ? capBullets(expanded.proofPoints.map(pp => `${pp.stat} — ${pp.source}`), MAX_BULLETS, MAX_BULLET_CHARS)
      : ['+102% brand preference lift — Dunkin\' × Big Brother S27',
         '+99% purchase intent lift — Dunkin\' × VMAs 2025',
         '2.5B votes cast — Big Brother S27',
         '1B+ social impressions — VMAs 2025'],
    mainIdea: 'Proves the approach works with real data from past campaigns.',
  })

  // Slide 8: From Idea to Cultural Moment (How It Works)
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'how_it_works',
    editable: true,
    type: 'content',
    title: 'From Idea to Cultural Moment',
    subtitle: 'The Activation Playbook',
    bullets: approachSteps.length > 0
      ? capBullets(approachSteps.map((step, i) => `${pad(i + 1)}  ${step}`), MAX_STEPS, MAX_STEP_CHARS)
      : ['01  Identify the cultural moment — match your brand to the right IP',
         '02  Design native integration — content that belongs, not interrupts',
         '03  Amplify across platforms — CBS, Paramount+, social, in-store'],
    mainIdea: 'Walks through the activation playbook step by step.',
  })

  // Slide 9: Your Opportunity with Paramount (Custom Plan)
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'custom_plan',
    editable: true,
    type: 'content',
    title: 'Your Opportunity with Paramount',
    subtitle: company !== '—' ? `Custom Plan for ${company}` : undefined,
    bullets: expanded?.customPlan
      ? capBullets([
          expanded.customPlan.recommendedProperties?.length
            ? `Properties: ${expanded.customPlan.recommendedProperties.join(', ')}` : '',
          expanded.customPlan.formats?.length
            ? `Formats: ${expanded.customPlan.formats.join(', ')}` : '',
          expanded.customPlan.audienceMatch || '',
          expanded.customPlan.timeline ? `Timeline: ${expanded.customPlan.timeline}` : '',
        ].filter(Boolean), MAX_BULLETS, MAX_BULLET_CHARS)
      : ['Tailored IP selection based on your audience',
         'Custom integration formats for your brand',
         'Specific audience alignment with Paramount properties',
         'Activation timeline synced to your calendar'],
    mainIdea: 'Tailors the opportunity specifically to this prospect.',
  })

  // Slide 10: Investment vs Impact (ROI Framing)
  slides.push({
    slideNumber: slideNum++,
    slideKey: 'roi_framing',
    editable: false,
    type: 'content',
    title: 'Investment vs Impact',
    subtitle: undefined,
    bullets: [
      project?.totalValue ? `Total Investment: ${project.totalValue}` : '',
      project?.duration ? `Timeline: ${project.duration}` : '',
      company !== '—' ? `Reach: ${company} reaches its exact audience through Paramount\'s 200M+ monthly viewers` : '',
      'Engagement: Native integrations drive 3.2× higher recall than standard ads',
      'Conversion: QR, app, retail pathways from cultural moment to measurable outcome',
    ].filter(Boolean),
    mainIdea: 'Frames the investment as a return, not a cost.',
  })

  // Slide 11: Next Steps — conditional
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
      mainIdea: 'Closes with a clear call to action and path forward.',
    })
  }

  // Slide 12: Closing
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
    mainIdea: 'Ends on a human note and keeps the door open.',
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
