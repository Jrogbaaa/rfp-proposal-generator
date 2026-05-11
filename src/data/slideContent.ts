export interface SlideData {
  slideNumber: number
  slideKey?: string    // stable semantic identity regardless of position (e.g. 'prob1', 'ben1')
  editable?: boolean   // true if user can click-to-edit bullets/title in the preview
  title: string
  subtitle?: string
  bullets: string[]
  type: 'title' | 'section' | 'content' | 'impact' | 'closing'
  mainIdea?: string    // one-sentence purpose shown in the UI below the card, not on the slide
}

export const TMOBILE_PARAMOUNT_SLIDES: SlideData[] = [
  {
    slideNumber: 1,
    title: 'T-Mobile × Paramount',
    subtitle: 'Turning Connectivity Into Cultural Currency',
    bullets: [
      'From wireless carrier to cultural lifestyle brand.',
      'Paramount is the bridge from utility to identity.',
    ],
    type: 'title',
  },
  {
    slideNumber: 2,
    title: 'The New Reality of Attention',
    subtitle: 'T-Mobile · The Attention Crisis',
    bullets: [
      'Media is fragmenting — T-Mobile customers live across TikTok, streaming, and fan communities, not linear channels.',
      '67% of telecom switchers cite "brand connection" over price — attention is the new currency.',
      'Average attention span for telecom ads: 1.4 seconds on mobile. Culture is the only way through.',
    ],
    type: 'content',
  },
  {
    slideNumber: 3,
    title: 'Why Most Brand Campaigns Fail Today',
    subtitle: 'The Reframe',
    bullets: [
      'Interruptive ads don\u2019t create telecom switchers — they create skip buttons.',
      'Media spend \u2260 cultural relevance. T-Mobile\u2019s competitors are outspending, not out-mattering.',
      'Brands that buy impressions but don\u2019t earn attention will never become a Category of One.',
    ],
    type: 'content',
  },
  {
    slideNumber: 4,
    title: 'What This Is Costing You',
    subtitle: undefined,
    bullets: [
      'Lost cultural relevance — T-Mobile risks being invisible to Gen Z as they choose carriers.',
      'Declining ROI on traditional media — 5G isn\u2019t a message, it\u2019s an experience that requires experiential marketing.',
      'Weak emotional connection — "brand as cultural utility" is the new frontier, and competitors are closing in.',
    ],
    type: 'content',
  },
  {
    slideNumber: 5,
    title: 'Winning Brands Don\u2019t Buy Media — They Join Culture',
    subtitle: 'The Core Insight',
    bullets: [
      'T-Mobile in the VMAs — not a sponsor, a cultural co-conspirator.',
      'T-Mobile in Big Brother — cups in hands, feeds in phones, brand becomes content.',
      'T-Mobile at NFL on CBS — 25M viewers experience connectivity, not hear about it.',
    ],
    type: 'impact',
  },
  {
    slideNumber: 6,
    title: 'How Paramount Turns T-Mobile Into a Cultural Moment',
    subtitle: 'T-Mobile × Paramount',
    bullets: [
      'IP: VMAs, NFL on CBS, Big Brother, GRAMMYs — culture\u2019s biggest stages.',
      'Talent: Sabrina Carpenter, Patrick Mahomes, Tony Romo — authentic connections.',
      'Multi-platform: CBS + Paramount+ + MTV + BET + social reach of 200M+ Americans monthly.',
      'Integration formats: 5G-powered second-screen experiences, shoppable QR, retail hub activations.',
    ],
    type: 'content',
  },
  {
    slideNumber: 7,
    title: 'Proven Impact at Scale',
    subtitle: 'When brands integrate into culture — this happens',
    bullets: [
      '+102% brand preference lift — Dunkin\u2019 × Big Brother S27 (iSpot)',
      '+99% purchase intent lift — Dunkin\u2019 × VMAs 2025 (iSpot)',
      '+156% search lift — Under Armour × CBS Sports HQ shoppable QR (EDO)',
      '2.8× higher brand consideration — telecom brands in cultural moments',
    ],
    type: 'impact',
  },
  {
    slideNumber: 8,
    title: 'From Idea to Cultural Moment',
    subtitle: 'The Activation Playbook',
    bullets: [
      '01  Identify cultural moment — match T-Mobile to VMAs, NFL, Big Brother, GRAMMYs.',
      '02  Design native integration — 5G experiences, creator-led formats, second-screen activations.',
      '03  Amplify across platforms — CBS, Paramount+, social, T-Mobile retail hubs, shoppable moments.',
    ],
    type: 'content',
  },
  {
    slideNumber: 9,
    title: 'Your Opportunity with Paramount',
    subtitle: 'Custom Plan for T-Mobile',
    bullets: [
      'Properties: VMAs 2026, NFL on CBS, Big Brother S28, 68th GRAMMYs.',
      'Formats: 5G-powered fan experiences, creator-led franchises, shoppable streaming.',
      'Audience: Gen Z cultural creators, multicultural growth, competitive switchers.',
      'Timeline: Q3 2026 \u2013 Q1 2027 activation window.',
    ],
    type: 'content',
  },
  {
    slideNumber: 10,
    title: 'Investment vs Impact',
    subtitle: undefined,
    bullets: [
      'Reach: T-Mobile accesses 87% of Gen Z monthly via Paramount platforms.',
      'Engagement: Native integrations drive 2.8× higher consideration for telecom.',
      'Conversion: Switcher engine powered by iSpot, EDO, and Paramount 1st-party data.',
    ],
    type: 'content',
  },
  {
    slideNumber: 11,
    title: 'Next Steps',
    subtitle: undefined,
    bullets: [
      '01  Confirm partnership letter of intent — 5 business days.',
      '02  Lock VMAs and NFL on CBS inventory — limited availability.',
      '03  Co-develop 5G integration concepts with Paramount Studios.',
      '04  Go live: VMAs August 31, 2026 → NFL September 2026.',
    ],
    type: 'content',
  },
  {
    slideNumber: 12,
    title: 'Let\u2019s Build This Together',
    subtitle: undefined,
    bullets: [
      'T-Mobile is building a Category of One.',
      'Paramount builds the cultural architecture to power it.',
      'Let\u2019s define what connectivity looks like next — together.',
    ],
    type: 'closing',
  },
]
