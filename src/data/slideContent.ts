export interface SlideData {
  slideNumber: number
  slideKey?: string    // stable semantic identity regardless of position (e.g. 'prob1', 'ben1')
  editable?: boolean   // true if user can click-to-edit bullets/title in the preview
  title: string
  subtitle?: string
  bullets: string[]
  type: 'title' | 'section' | 'content' | 'impact' | 'closing'
}

export const TMOBILE_PARAMOUNT_SLIDES: SlideData[] = [
  {
    slideNumber: 1,
    title: 'T-Mobile x Paramount',
    subtitle: 'Defining the Category of One Through Culture',
    bullets: [
      'Turning connectivity into a lived cultural experience.',
      'Transforming customers into advocates who proudly say:',
      '"I\'m with T-Mobile."',
    ],
    type: 'title',
  },
  {
    slideNumber: 2,
    title: 'The Opportunity',
    subtitle: undefined,
    bullets: [
      'T-Mobile is evolving from Challenger to Champion — beyond wireless into the Connected Experience Category.',
      'To win, we must deliver:',
      'Cultural fame at scale',
      'Creator-powered credibility',
      'AI-enabled precision',
      'Measurable business outcomes',
      'Paramount delivers across all three Missions:',
      '1. Cultural Connections',
      '2. Creator Driven IP',
      '3. Data Driven Decisioning',
    ],
    type: 'content',
  },
  {
    slideNumber: 3,
    title: 'Our Platform',
    subtitle: 'Connectivity in Culture\u2122',
    bullets: [
      'We embed T-Mobile where culture and connectivity collide:',
      'Live sports',
      'Premium entertainment',
      'Creator ecosystems',
      'Streaming-first environments',
      'Retail extensions',
      'This is not sponsorship.',
      'This is essential presence.',
    ],
    type: 'section',
  },
  {
    slideNumber: 4,
    title: 'Mission 1 \u2014 Cultural Connections',
    subtitle: 'Own the Moment. Extend the Experience.',
    bullets: [
      'Entertainment Tentpoles: GRAMMY Awards, VMAs, Golden Globes, Paramount+ premieres, Yellowstone universe',
      'Sports Platforms: NFL & College Football, PGA + season extensions, SEC, UEFA, NCAA March Madness',
      'Every activation built to:',
      'Drive fame',
      'Demonstrate network superiority',
      'Unlock exclusive member value',
      'Convert awareness into action',
    ],
    type: 'content',
  },
  {
    slideNumber: 5,
    title: 'Sportstainment & Retail Integration',
    subtitle: undefined,
    bullets: [
      'Elevated Fan Experience:',
      'Second-screen enhancements powered by 5G',
      'Real-time social integrations',
      'Creator-led live breakdown formats',
      'Retail as Cultural Hub:',
      'Transform stores into experiential fan destinations',
      'Sync in-store activations with live programming',
      'Drive traffic through exclusive member unlocks',
    ],
    type: 'content',
  },
  {
    slideNumber: 6,
    title: 'Mission 2 \u2014 Creator Driven IP',
    subtitle: 'Build IP. Don\u2019t Borrow Attention.',
    bullets: [
      'Creators are cultural accelerants.',
      'Invest in scalable, repeatable creator-led franchises',
      'Prioritize trendsetters over volume influencers',
      'Embed T-Mobile as essential to the experience',
      'Build multi-season equity',
      'Focus areas: Live video podcasts, Gaming & connectivity culture, Multicultural-first creator ecosystems, Shoppable streaming integrations',
      'Goal: Spark FOMO. Disrupt algorithms. Build loyalty.',
    ],
    type: 'section',
  },
  {
    slideNumber: 7,
    title: 'Mission 3 \u2014 Data Driven Decisioning',
    subtitle: 'Precision at Scale',
    bullets: [
      '100% addressable. AI-enabled. Real-time optimized.',
      'Personalization: Dynamic creative by segment, Predictive targeting for switchers',
      'Measurement: Full-funnel reporting (Brand \u2192 Search \u2192 Conversion), Cross-platform reach & frequency solutions, Deterministic tagging aligned to iSpot, EDO, comScore',
      'Switcher Engine: Heavy-up against ready-to-act prospects, Contextual placements during life-change moments',
    ],
    type: 'section',
  },
  {
    slideNumber: 8,
    title: 'Audience Strategy',
    subtitle: undefined,
    bullets: [
      'Tailored to T-Mobile\u2019s priority segments:',
      'Gen Z cultural creators',
      'Gen Pop multicultural growth audiences',
      'Loyalists & competitive switchers',
      'Prepaid value seekers',
      'Business decision makers',
      'Creative and media customized by:',
      'Postpaid, Broadband, Metro, T-Mobile for Business',
    ],
    type: 'content',
  },
  {
    slideNumber: 9,
    title: 'From Fame to Business Impact',
    subtitle: undefined,
    bullets: [
      'Upper Funnel: Cultural relevance & brand lift, Share of conversation, Advocacy indicators',
      'Mid / Lower Funnel: Search lift, Store visitation, App engagement, Conversion mapping',
      'Enterprise Impact: Media efficiency gains, AI-driven optimization, Scalable, repeatable IP',
    ],
    type: 'impact',
  },
  {
    slideNumber: 10,
    title: 'The Champion Era Starts Now',
    subtitle: undefined,
    bullets: [
      'T-Mobile is building a Category of One.',
      'Paramount builds the cultural architecture to power it.',
      'Fame.',
      'Creators.',
      'Data.',
      'Business Outcomes.',
      'Let\u2019s define what connectivity looks like next \u2014 together.',
    ],
    type: 'closing',
  },
]
