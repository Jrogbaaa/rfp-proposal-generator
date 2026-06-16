/**
 * Layer 3 — Craft / few-shot exemplars.
 *
 * One compact, full brief → ideal `ExpandedContent` JSON pair distilled from the real
 * Dunkin' reference. The persuasion-arc patterns were previously only *described* in the
 * knowledge base playbook; this promotes them to a worked example that *shows* the voice,
 * grounding, and "named property → mechanic → measurable outcome" formula.
 *
 * Injected into the generation `contents` array as a prior user/model turn (the cleanest
 * few-shot shape for Gemini), BEFORE the live brief. Gated to the `paramount-rfp` deck type
 * only (see `llmService.ts`) to control token cost.
 *
 * To add more exemplars (e.g. the Under Armour sports archetype), push another
 * { user } / { model } pair onto FEW_SHOT_EXEMPLARS — keep the model turn's item counts
 * aligned with the SYSTEM_PROMPT schema so the example never teaches wrong counts.
 */

export interface ExemplarTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

const DUNKIN_BRIEF = `Here is the client brief:

---
Project: Dunkin' 2026 Cultural Partnership
Client: Maria Chen, maria.chen@dunkinbrands.com, Dunkin'
Timeline: Q3 2026 – Q1 2027
Budget: $4M

Problems:
- Gen Z discovers food brands on social, not in ad breaks — Dunkin' is adjacent to culture, not inside it
- App engagement and rewards sign-ups have plateaued with the under-30 audience
- Competitors are winning the "morning ritual" conversation Dunkin' used to own
- Heavy linear spend is producing declining brand recall quarter over quarter

Benefits:
- Become a native part of the shows and moments Gen Z already watches
- Drive measurable in-store visits and app installs, not just impressions
- Reclaim cultural relevance with an authentic, energetic presence
- Prove ROI with deterministic, full-funnel measurement
---

Parsed information:
- Company: Dunkin'
- Project: Dunkin' 2026 Cultural Partnership
- Problems identified:
  1. Gen Z discovers food brands on social, not in ad breaks
  2. App engagement plateaued with under-30 audience
  3. Competitors winning the "morning ritual" conversation
  4. Heavy linear spend, declining brand recall
- Benefits/outcomes desired:
  1. Become native to the shows Gen Z watches
  2. Drive in-store visits and app installs
  3. Reclaim cultural relevance
  4. Prove ROI with full-funnel measurement

Generate personalized expansions for each problem and benefit that reference specific details from this brief. Make the content feel tailored to Dunkin', not generic.`;

const DUNKIN_IDEAL_JSON = `{
  "problemExpansions": [
    "Gen Z doesn't watch Dunkin' ads — they skip them. Discovery now happens inside Big Brother live feeds, VMAs fan threads, and TikTok, where Dunkin' is currently a bystander rather than a character in the story.",
    "Dunkin's rewards app has stalled with the under-30 audience because sign-ups are driven by cultural reasons to engage, not banner prompts. Without a reason rooted in content they love, installs flatline.",
    "The 'morning ritual' conversation Dunkin' built its brand on is being re-litigated daily on social, and culturally-native challengers are winning it by showing up where Gen Z lives.",
    "Linear-heavy spend is producing diminishing returns — QSR brand recall from traditional TV fell 19% in 2025. Dunkin' is paying for impressions while losing memory."
  ],
  "benefitExpansions": [
    "By integrating into Big Brother S28 and VMAs 2026, Dunkin' stops interrupting content and becomes part of it — earning attention instead of buying it.",
    "A breakfast-rewards mechanic tied to Big Brother gives Gen Z a culturally-motivated reason to install the app and visit a store, converting fandom into measurable foot traffic.",
    "Owning a season-long presence in the shows Gen Z already watches restores Dunkin's cultural authority on the morning ritual it pioneered.",
    "Every activation is wired to iSpot, EDO, and Comscore so Dunkin' sees deterministic visit lift, install lift, and full-funnel ROI — not just reach."
  ],
  "culturalShift": [
    "73% of Gen Z discovers new restaurants through social media, not advertising — the QSR discovery path has moved off the ad break entirely.",
    "Dunkin's audience lives in Big Brother live feeds, VMAs fan communities, and TikTok, not linear channels — co-viewing and streaming have fragmented attention.",
    "Average QSR brand recall from traditional TV ads fell 19% in 2025 — presence no longer equals memory."
  ],
  "realProblem": [
    "Interruptive ads create skip buttons, not cravings — they don't drive app engagement or store visits.",
    "Media spend alone can't buy cultural relevance; Dunkin' is present in the feed but not remembered.",
    "Brands that buy impressions without earning attention lose the morning-ritual conversation to culturally-native challengers."
  ],
  "costOfInaction": [
    "Lost attention — Dunkin' spots air but Gen Z scrolls past, leaving spend without recall.",
    "Declining ROI — a 19% drop in QSR ad recall means every linear dollar buys less memory than last year.",
    "Weak emotional connection — without cultural currency, Dunkin' forfeits the loyalty its rituals once earned."
  ],
  "coreInsight": "Winning brands don't buy media — they join culture, and Dunkin' wins by becoming a character in the shows Gen Z already loves.",
  "proofPoints": [
    { "stat": "+102% brand preference lift", "source": "Dunkin' × Big Brother S27", "context": "Season-long integration with a breakfast rewards mechanic (iSpot, 2025)" },
    { "stat": "+99% purchase intent lift", "source": "Dunkin' × VMAs 2025", "context": "Custom talent activation with shoppable AR (iSpot, 2025)" },
    { "stat": "+34% in-store visit lift", "source": "Dunkin' × Big Brother breakfast rewards QR mechanic", "context": "Measured via Placer.ai, 2025" }
  ],
  "customPlan": {
    "recommendedProperties": ["Big Brother S28", "MTV VMAs 2026", "68th GRAMMY Awards"],
    "formats": ["Season-long integration with permanent coffee-cart fixture", "Custom talent sketches", "Shoppable AR/QR breakfast rewards"],
    "audienceMatch": "Big Brother S28 (54% Gen Z/Millennial, 61% female) and the VMAs (37M+ Gen Z) over-index exactly on Dunkin's under-30 morning-ritual target.",
    "timeline": "Q3 2026 (Big Brother S28 premiere) through Q1 2027 (post-GRAMMYs amplification)"
  },
  "industryInsights": [
    { "trend": "73% of Gen Z discovers new restaurants through social media", "implication": "Dunkin' needs cultural presence inside content, not just ad presence around it", "category": "QSR" },
    { "trend": "QSR delivery app usage up 34% among Gen Z while store visits decline", "implication": "Dunkin' must tie cultural moments to app + in-store mechanics to convert fandom into traffic", "category": "QSR" }
  ],
  "approachSteps": [
    "Identify the cultural moment — anchor Dunkin' to Big Brother S28 and VMAs 2026, the properties its audience already watches.",
    "Design the native integration — a permanent in-show coffee cart and a breakfast-rewards QR mechanic that lives inside the content.",
    "Amplify across platforms — extend the moment through Paramount+, social-first talent sketches, and in-store activations."
  ],
  "nextSteps": [
    "Lock Big Brother S28 season-long inventory before the summer slate sells out.",
    "Confirm the breakfast-rewards mechanic and VMAs talent concept.",
    "Align on the iSpot / EDO / Comscore measurement framework before go-live.",
    "Schedule a kickoff with the Paramount partnerships team."
  ],
  "paramountMedia": {
    "opportunityStatement": "Make Dunkin' the first-ever season-long breakfast partner of Big Brother S28 and the morning voice of VMAs 2026 — an exclusive, culture-first ownership of the moments Gen Z watches, not the ad breaks they skip.",
    "paramountIPAlignments": [
      { "propertyName": "Big Brother S28", "description": "First-ever season-long breakfast partner with an in-house coffee cart and a live rewards mechanic.", "audienceStat": "6.8M avg viewers, 61% female, 54% Gen Z/Millennial", "network": "CBS" },
      { "propertyName": "MTV VMAs 2026", "description": "Own the morning-after-music moment with custom talent sketches and shoppable AR looks.", "audienceStat": "37M+ Gen Z viewers globally", "network": "MTV" },
      { "propertyName": "Love Island USA S6", "description": "Summer streaming heat with Gen Z core, ideal for iced-coffee social drops.", "audienceStat": "11M+ streams premiere week, 18-34 core", "network": "Paramount+" },
      { "propertyName": "68th GRAMMY Awards", "description": "Extend the partnership into music's biggest night for a Q1 amplification beat.", "audienceStat": "20M+ viewers, 45% Gen Z", "network": "CBS" }
    ],
    "audienceInsights": [
      "Paramount reaches 87% of Gen Z (18-24) monthly across all platforms.",
      "Big Brother live feeds generate 2.3M+ Paramount+ daily actives during the summer run.",
      "68% of Paramount+ daily actives are aged 18-34.",
      "VMAs is the #1 most social TV event annually, driving 45M+ posts."
    ],
    "integrationConcepts": [
      { "conceptTitle": "Big Brother Breakfast Rewards Mechanic", "property": "Big Brother S28", "mechanic": "A permanent in-house Dunkin' coffee cart plus a live QR that unlocks app-only breakfast rewards each time houseguests compete for morning power.", "outcome": "Drives app installs and in-store visits — modeled on the +34% visit lift from S27." },
      { "conceptTitle": "VMAs Morning-After Drop", "property": "MTV VMAs 2026", "mechanic": "Custom talent sketches and shoppable AR looks that let fans claim a limited VMAs iced-coffee drop the morning after the show.", "outcome": "Captures purchase intent in-moment — S25 VMAs work drove +99% intent lift." }
    ],
    "talentOpportunities": [
      "Meg Stalter custom brand sketches during the VMAs pre-show",
      "Sabrina Carpenter social-first iced-coffee moment tied to the VMAs",
      "Julie Chen Moonves in-show Big Brother rewards call-outs"
    ],
    "programmingCalendar": [
      { "tentpole": "Big Brother S28 premiere", "date": "Summer 2026", "reach": "6.8M avg viewers", "opportunity": "Launch the season-long coffee cart and rewards mechanic." },
      { "tentpole": "MTV VMAs", "date": "August 31, 2026", "reach": "37M+ Gen Z", "opportunity": "Own the morning-after drop with talent sketches and AR looks." },
      { "tentpole": "Love Island USA S6", "date": "Summer 2026", "reach": "11M+ streams premiere week", "opportunity": "Iced-coffee social drops against the streaming heat." },
      { "tentpole": "68th GRAMMY Awards", "date": "February 2, 2026", "reach": "20M+ viewers", "opportunity": "Q1 amplification beat extending the partnership into music's biggest night." },
      { "tentpole": "NFL on CBS", "date": "September 2026 – February 2027", "reach": "24.3M avg viewers per game", "opportunity": "Always-on morning-fuel surround for game-day mornings." }
    ],
    "measurementFramework": [
      "iSpot deterministic sales-lift measurement for QSR visits",
      "EDO search lift + conversion correlation by creative",
      "Comscore cross-platform deduplicated reach",
      "Placer.ai in-store visit attribution for the rewards mechanic"
    ],
    "investmentTiers": [
      { "tierName": "Core", "budget": "$2M–$3M", "inclusions": ["Big Brother S28 season-long integration", "Coffee-cart fixture + rewards QR", "iSpot + EDO measurement"] },
      { "tierName": "Enhanced", "budget": "$3M–$5M", "inclusions": ["Everything in Core", "VMAs morning-after drop + talent sketches", "Paramount+ social amplification"] },
      { "tierName": "Signature", "budget": "$5M–$7M", "inclusions": ["Everything in Enhanced", "GRAMMYs Q1 amplification", "Always-on NFL on CBS morning surround", "Full-funnel closed-loop reporting"] }
    ],
    "nextSteps": [
      "Lock Big Brother S28 season-long inventory.",
      "Confirm the breakfast-rewards mechanic and VMAs talent.",
      "Align on the measurement framework.",
      "Schedule the partnerships kickoff."
    ],
    "appendixItems": [
      "Case study: Dunkin' × Big Brother S27 — +102% brand preference, +34% visit lift",
      "Audience data: Big Brother S28 demos (6.8M avg, 54% Gen Z/Millennial)",
      "Measurement proof: iSpot deterministic attribution at 97% accuracy across QSR"
    ]
  }
}`;

export const FEW_SHOT_EXEMPLARS: ExemplarTurn[] = [
  { role: 'user', parts: [{ text: DUNKIN_BRIEF }] },
  { role: 'model', parts: [{ text: DUNKIN_IDEAL_JSON }] },
];
