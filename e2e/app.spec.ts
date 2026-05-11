import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('rfp_app_entered', '1')
  })
})

const SAMPLE_BRIEF = `Project: Digital Customer Experience Transformation
Client: Sarah Martinez, sarah.martinez@starbucks.com, Starbucks
Timeline: 4 months
Budget: $175,000

Problems:
- Mobile app engagement has dropped 23% since last quarter
- Customer loyalty program data is siloed across multiple systems
- Customer service resolution time averages 4.2 days
- Checkout abandonment rate is 47% on mobile

Benefits:
- Real-time unified customer view across all touchpoints
- 15-20% lift in mobile app engagement within 90 days
- Reduce customer service resolution time by 60%
- Increase mobile checkout completion by 30%`

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function geminiContentBody() {
  return JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            problemExpansions: [
              'Mobile engagement has declined sharply, directly impacting revenue and customer lifetime value.',
              'Siloed data systems prevent Starbucks from delivering the personalised experience customers expect.',
              'Slow resolution times are eroding brand trust and driving customer churn at scale.',
              'Mobile checkout friction is costing significant conversion revenue every quarter.',
            ],
            benefitExpansions: [
              'A unified customer view enables hyper-personalised experiences that drive loyalty and repeat purchases.',
              'A 15-20% engagement lift translates to measurable revenue growth within the first quarter.',
              'Faster resolution dramatically improves NPS and reduces costly repeat contacts.',
              'Eliminating checkout friction directly increases completed transactions and revenue per visit.',
            ],
            culturalShift: [
              'QSR discovery is now 73% social-media-driven among Gen Z — traditional ads miss them entirely.',
              'Starbucks customers live across TikTok, streaming, and fan communities, not linear TV channels.',
              'Average QSR brand recall from TV ads fell 19% in 2025 — attention has fundamentally shifted.',
            ],
            realProblem: [
              'Interruptive ads don\'t drive app engagement — they create skip buttons.',
              'Media spend ≠ cultural relevance. Starbucks is present but not remembered.',
              'Brands buying impressions but not earning attention will lose to culturally-native competitors.',
            ],
            costOfInaction: [
              'Lost attention — Starbucks ads play but Gen Z doesn\'t remember.',
              'Low brand recall — declining ROI on traditional media, 19% drop in QSR ad recall.',
              'Weak emotional connection — no cultural currency with the audience that matters most.',
            ],
            coreInsight: 'Winning Brands Don\'t Buy Media — They Join Culture',
            proofPoints: [
              { stat: '+102% brand preference lift', source: 'Dunkin\' × Big Brother S27', context: 'Season-long integration' },
              { stat: '+99% purchase intent lift', source: 'Dunkin\' × VMAs 2025', context: 'Custom talent activation' },
              { stat: '+34% in-store visit lift', source: 'Dunkin\' × Big Brother QR mechanic', context: 'Measured via Placer.ai' },
            ],
            customPlan: {
              recommendedProperties: ['Big Brother S28', 'VMAs 2026', '68th GRAMMY Awards'],
              formats: ['Season-long integration', 'Custom talent sketches', 'Shoppable AR/QR'],
              audienceMatch: 'Gen Z coffee culture consumers who over-index on reality TV and live music events.',
              timeline: 'Q3 2026 – Q1 2027',
            },
            industryInsights: [
              { trend: '73% of Gen Z discovers new restaurants through social media', implication: 'Starbucks needs cultural presence, not just ad presence', category: 'QSR' },
              { trend: 'QSR delivery app usage up 34% among Gen Z', implication: 'Digital-first discovery requires digital-first brand moments', category: 'QSR' },
            ],
          }),
        }],
      },
    }],
  })
}

function geminiIterationBody() {
  return JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            reply: "Done! I've tightened the language across all sections — the copy is now more direct and concise.",
            updatedContent: {
              culturalShift: [
                'QSR discovery is now 73% social-media-driven — traditional ads miss Gen Z entirely.',
                'Starbucks customers live in TikTok feeds and fan communities, not linear TV.',
                'Brand recall from TV ads fell 19% in 2025. Attention has shifted permanently.',
              ],
              realProblem: [
                'Interruptive ads generate skip buttons, not engagement.',
                'Media spend alone cannot buy cultural relevance.',
                'Brands earning impressions but not attention lose to culturally-native competitors.',
              ],
              costOfInaction: [
                'Lost attention — ads play but Gen Z doesn\'t remember.',
                'Low brand recall — 19% decline in QSR ad effectiveness.',
                'Weak emotional connection — no cultural currency with the audience that matters.',
              ],
              coreInsight: 'Winning Brands Don\'t Buy Media — They Join Culture.',
              approachSteps: [
                'Identify the cultural moment — select the right Paramount IP.',
                'Design a native integration that becomes part of the content.',
                'Amplify across Paramount\'s full ecosystem for scale.',
              ],
              nextSteps: [
                'Lock preferred inventory for 2026 tentpoles.',
                'Confirm integration concept and brand brief.',
                'Align on measurement framework before go-live.',
                'Schedule kick-off call with Paramount partnerships team.',
              ],
              problemExpansions: [
                'Declining mobile engagement is hurting revenue and retention.',
                'Siloed data prevents personalisation at scale.',
                'Slow resolution times drive churn and increase support costs.',
                'Mobile checkout friction is losing conversions daily.',
              ],
              benefitExpansions: [
                'Unified customer data unlocks personalisation that drives loyalty.',
                'A 15-20% engagement lift delivers measurable revenue within 90 days.',
                'Faster resolution boosts NPS and cuts repeat contacts by half.',
                'Removing friction increases mobile checkout completion by 30%.',
              ],
            },
          }),
        }],
      },
    }],
  })
}

async function mockGeminiApi(page: Page) {
  let callCount = 0
  // Intercept the backend proxy endpoint — Gemini calls go through /api/gemini/generate-content
  await page.route('**/api/gemini/generate-content', (route) => {
    callCount++
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: callCount === 1 ? geminiContentBody() : geminiIterationBody(),
    })
  })
}

async function mockGoogleOAuth(page: Page) {
  // Block the GIS library from loading — otherwise it overwrites our window.google mock
  await page.route('**/accounts.google.com/gsi/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
  })

  // Inject mock window.google before ANY page scripts run
  await page.addInitScript(function () {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google = {
      accounts: {
        oauth2: {
          initTokenClient: function (config: { callback: (r: Record<string, unknown>) => void }) {
            return {
              requestAccessToken: function () {
                config.callback({ access_token: 'fake-test-token', expires_in: 3600 })
              },
            }
          },
          revoke: function () {},
        },
      },
    }
  })
}

async function mockGoogleSlidesApi(page: Page) {
  // Mock Drive API — covers both the template-copy path (/drive/v3/files/.../copy)
  // and the pptx-upload path (/upload/drive/v3/files)
  await page.route('https://www.googleapis.com/**drive**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'fake-presentation-id',
        webViewLink: 'https://docs.google.com/presentation/d/fake-presentation-id/edit',
      }),
    })
  })

  await page.route('**/slides.googleapis.com/**', (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (url.includes(':batchUpdate')) {
      // batchUpdate (both template path and Paramount path)
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    } else if (method === 'GET') {
      // Template path: GET presentation → return 18 slides with objectIds
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          presentationId: 'fake-presentation-id',
          slides: Array.from({ length: 18 }, (_, i) => ({
            objectId: 'slide_' + i,
            pageElements: [],
          })),
        }),
      })
    } else {
      // Paramount path: POST create presentation
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ presentationId: 'fake-presentation-id' }),
      })
    }
  })

  // Block logo fetch requests (fault-tolerant in the app, but we suppress noise)
  await page.route('**/*favicon*', (route) => {
    route.fulfill({ status: 200, contentType: 'image/png', body: '' })
  })
}

/** Navigate to the Iterate (step 2) with Gemini mocked */
async function goToIterateStep(page: Page) {
  await mockGeminiApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Prompt' }).click()
  await page.locator('textarea').fill(SAMPLE_BRIEF)
  await page.getByRole('button', { name: 'Continue to Refine' }).click()
  await expect(
    page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
  ).toBeVisible({ timeout: 10000 })
}

/** Navigate all the way to the Share (step 3) with all APIs mocked */
async function goToShareStep(page: Page) {
  await mockGeminiApi(page)
  await mockGoogleOAuth(page)   // must come before page.goto
  await mockGoogleSlidesApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Prompt' }).click()
  await page.locator('textarea').fill(SAMPLE_BRIEF)
  await page.getByRole('button', { name: 'Continue to Refine' }).click()
  await expect(
    page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
  ).toBeVisible({ timeout: 10000 })
  await page.getByLabel('Create Google Slides presentation').click()
  await expect(page.getByText('Presentation created!')).toBeVisible({ timeout: 15000 })
}

function geminiContentWithApproachBody() {
  return JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            problemExpansions: [
              'Mobile engagement has declined sharply, directly impacting revenue and customer lifetime value.',
              'Siloed data systems prevent Starbucks from delivering the personalised experience customers expect.',
              'Slow resolution times are eroding brand trust and driving customer churn at scale.',
              'Mobile checkout friction is costing significant conversion revenue every quarter.',
            ],
            benefitExpansions: [
              'A unified customer view enables hyper-personalised experiences that drive loyalty and repeat purchases.',
              'A 15-20% engagement lift translates to measurable revenue growth within the first quarter.',
              'Faster resolution dramatically improves NPS and reduces costly repeat contacts.',
              'Eliminating checkout friction directly increases completed transactions and revenue per visit.',
            ],
            culturalShift: [
              'QSR discovery is now 73% social-media-driven among Gen Z.',
              'Starbucks customers live across TikTok, streaming, and fan communities.',
              'Average QSR brand recall from TV ads fell 19% in 2025.',
            ],
            realProblem: [
              'Interruptive ads don\'t drive app engagement.',
              'Media spend ≠ cultural relevance.',
              'Brands buying impressions but not earning attention.',
            ],
            costOfInaction: [
              'Lost attention — Starbucks ads play but Gen Z doesn\'t remember.',
              'Low brand recall — declining ROI on traditional media.',
              'Weak emotional connection — no cultural currency.',
            ],
            coreInsight: 'Winning Brands Don\'t Buy Media — They Join Culture',
            proofPoints: [
              { stat: '+102% brand preference lift', source: 'Dunkin\' × Big Brother S27' },
              { stat: '+99% purchase intent lift', source: 'Dunkin\' × VMAs 2025' },
            ],
            customPlan: {
              recommendedProperties: ['Big Brother S28', 'VMAs 2026'],
              formats: ['Season-long integration', 'Custom talent sketches'],
              audienceMatch: 'Gen Z coffee culture consumers.',
              timeline: 'Q3 2026 – Q1 2027',
            },
            industryInsights: [
              { trend: '73% of Gen Z discovers new restaurants through social media', implication: 'Cultural presence required', category: 'QSR' },
            ],
            approachSteps: [
              'Identify the cultural moment — match Starbucks to Big Brother S28 and VMAs 2026.',
              'Design native integration — in-show coffee cart, shoppable AR, rewards mechanic.',
              'Amplify across platforms — CBS, Paramount+, social, in-store activations.',
            ],
            nextSteps: [
              'Sign engagement letter within 5 business days.',
              'Kick-off discovery session with Starbucks digital team.',
              'Deliver technical audit report by end of week 2.',
            ],
          }),
        }],
      },
    }],
  })
}

// ─── App Shell ────────────────────────────────────────────────────────────────

test.describe('App Shell', () => {
  test('loads with header and New button', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('header').getByText('New')).toBeVisible()
  })

  test('shows 3-step progress bar (Draft, Refine, Export)', async ({ page }) => {
    await page.goto('/')
    // Use exact: true to avoid matching "Step 1 · Draft" etc.
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()
    await expect(page.getByText('Refine', { exact: true })).toBeVisible()
    await expect(page.getByText('Export', { exact: true })).toBeVisible()
  })

  test('starts on Step 1 Draft', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Step 1 · Draft')).toBeVisible()
    // Use heading role to avoid matching the PdfUploader's duplicate text
    await expect(page.getByRole('heading', { name: 'Upload your brief here' })).toBeVisible()
  })
})

// ─── Step 1: Input Modes ──────────────────────────────────────────────────────

test.describe('Step 1 – Input Modes', () => {
  test('defaults to PDF upload mode', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Drop a PDF — Gemini extracts structure automatically')).toBeVisible()
  })

  test('switches to Prompt mode', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await expect(page.locator('textarea')).toBeVisible()
    await expect(page.getByText('Paste your brief or type a prompt')).toBeVisible()
  })

  test('switches back to Upload PDF mode', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.getByRole('button', { name: 'Upload PDF' }).click()
    await expect(page.getByText('Drop a PDF — Gemini extracts structure automatically')).toBeVisible()
    await expect(page.locator('textarea')).not.toBeVisible()
  })
})

// ─── Step 1: Brief Parsing ────────────────────────────────────────────────────

test.describe('Step 1 – Brief Parsing', () => {
  test('right panel shows "Waiting for brief" when empty', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Waiting for brief')).toBeVisible()
  })

  test('"Continue to Refine" button is hidden when brief is empty', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Continue to Refine' })).not.toBeVisible()
  })

  test('entering brief text switches preview to "Brief parsed"', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await expect(page.getByText('Brief parsed')).toBeVisible()
  })

  test('parsed fields (Company, Project, Timeline, Budget) appear in preview', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    // Check the right panel parsed field values
    const preview = page.locator('section').filter({ hasText: 'Preview' })
    await expect(preview.getByText('Starbucks', { exact: true })).toBeVisible()
    await expect(preview.getByText('Digital Customer Experience Transformation')).toBeVisible()
    await expect(preview.getByText('4 months')).toBeVisible()
    await expect(preview.getByText('$175,000')).toBeVisible()
  })

  test('"Continue to Refine" button appears when brief has content', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await expect(page.getByRole('button', { name: 'Continue to Refine' })).toBeVisible()
  })
})

// ─── Step 2: Slide Preview ────────────────────────────────────────────────────

test.describe('Step 2 – Slide Preview', () => {
  test('navigates to Refine step with Slide Preview heading', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('Step 2 · Refine')).toBeVisible()
    await expect(page.getByText('Slide Preview')).toBeVisible()
  })

  test('right sidebar shows AI Copywriter header and chat input', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('AI Copywriter')).toBeVisible()
    await expect(page.locator('textarea[placeholder*="Tell me how to change"]')).toBeVisible()
  })

  test('export button is visible in the sidebar', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByLabel('Create Google Slides presentation')).toBeVisible()
  })
})

// ─── Step 2: Chat Interface ───────────────────────────────────────────────────

test.describe('Step 2 – Chat Interface', () => {
  test('shows AI greeting message on load', async ({ page }) => {
    await goToIterateStep(page)
    // Find the first assistant message bubble
    const greeting = page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
    await expect(greeting).toBeVisible()
  })

  test('greeting references the client company name', async ({ page }) => {
    await goToIterateStep(page)
    const greeting = page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
    await expect(greeting).toContainText('Starbucks')
  })

  test('shows all 6 suggested prompts on first load', async ({ page }) => {
    await goToIterateStep(page)
    for (const prompt of [
      'Suggest: More concise',
      'Suggest: Stronger ROI',
      'Suggest: Formal tone',
      'Suggest: More persuasive',
      'Suggest: Add urgency',
      'Suggest: Add metrics',
    ]) {
      await expect(page.getByRole('button', { name: prompt })).toBeVisible()
    }
  })

  test('chat textarea has correct placeholder text', async ({ page }) => {
    await goToIterateStep(page)
    await expect(
      page.locator('textarea[placeholder*="Tell me how to change"]')
    ).toBeVisible()
  })

  test('clicking a suggested prompt sends the message', async ({ page }) => {
    await goToIterateStep(page)
    await page.getByRole('button', { name: 'Suggest: More concise' }).click()
    const userBubble = page.locator('[class*="bg-navy-700"]').filter({ hasText: 'More concise' })
    await expect(userBubble).toBeVisible()
  })

  test('AI responds after a suggested prompt is sent', async ({ page }) => {
    await goToIterateStep(page)
    await page.getByRole('button', { name: 'Suggest: More concise' }).click()
    const replyBubble = page.locator('[class*="rounded-2xl"]').filter({
      hasText: "I've tightened the language across all sections"
    }).first()
    await expect(replyBubble).toBeVisible({ timeout: 10000 })
  })

  test('typing a custom message and pressing Enter sends it', async ({ page }) => {
    await goToIterateStep(page)
    const chatTextarea = page.locator('textarea[placeholder*="Tell me how to change"]')
    await chatTextarea.fill('Focus more on cost savings')
    await chatTextarea.press('Enter')
    const userBubble = page.locator('[class*="bg-navy-700"]').filter({ hasText: 'Focus more on cost savings' })
    await expect(userBubble).toBeVisible()
    const replyBubble = page.locator('[class*="rounded-2xl"]').filter({
      hasText: "I've tightened the language across all sections"
    }).first()
    await expect(replyBubble).toBeVisible({ timeout: 10000 })
  })

  test('suggested prompts disappear after first exchange', async ({ page }) => {
    await goToIterateStep(page)
    await page.getByRole('button', { name: 'Suggest: More concise' }).click()
    await expect(page.locator('[class*="rounded-2xl"]').filter({
      hasText: "I've tightened the language across all sections"
    }).first()).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('button', { name: 'Suggest: Stronger ROI' })
    ).not.toBeVisible()
  })
})

// ─── Step 2: Export Button ────────────────────────────────────────────────────

test.describe('Step 2 – Export Button', () => {
  test('is enabled when brief is present', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByLabel('Create Google Slides presentation')).toBeEnabled()
  })

  test('shows helper hint about creating a presentation', async ({ page }) => {
    await goToIterateStep(page)
    await expect(
      page.getByText('Creates a professional presentation in your Google Drive')
    ).toBeVisible()
  })
})

// ─── Step 3: Share Screen ─────────────────────────────────────────────────────

test.describe('Step 3 – Share Screen', () => {
  test('shows "Presentation created!" success heading', async ({ page }) => {
    await goToShareStep(page)
    await expect(page.getByText('Presentation created!')).toBeVisible()
  })

  test('shows "Open in Google Slides" link pointing to the fake presentation', async ({ page }) => {
    await goToShareStep(page)
    const link = page.getByRole('link', { name: 'Open in Google Slides' })
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    expect(href).toContain('fake-presentation-id')
  })

  test('shows "Share via Email" mailto link', async ({ page }) => {
    await goToShareStep(page)
    await expect(page.getByRole('link', { name: 'Share via Email' })).toBeVisible()
  })

  test('email body says "Hey team" not "Hi FirstName" or "Hi there"', async ({ page }) => {
    await goToShareStep(page)
    const mailtoHref = await page
      .getByRole('link', { name: 'Share via Email' })
      .getAttribute('href')
    expect(mailtoHref).toBeTruthy()
    const decoded = decodeURIComponent(mailtoHref!)
    expect(decoded).toContain('Hey team')
    expect(decoded).not.toMatch(/Hi Sarah/i)
    expect(decoded).not.toMatch(/Hi there/i)
  })

  test('email body contains the client company name', async ({ page }) => {
    await goToShareStep(page)
    const mailtoHref = await page
      .getByRole('link', { name: 'Share via Email' })
      .getAttribute('href')
    const decoded = decodeURIComponent(mailtoHref!)
    expect(decoded).toContain('Starbucks')
  })

  test('email body contains the slides URL', async ({ page }) => {
    await goToShareStep(page)
    const mailtoHref = await page
      .getByRole('link', { name: 'Share via Email' })
      .getAttribute('href')
    const decoded = decodeURIComponent(mailtoHref!)
    expect(decoded).toContain('fake-presentation-id')
  })

  test('email To: field is blank (intended for internal team, not the client)', async ({ page }) => {
    await goToShareStep(page)
    const mailtoHref = await page
      .getByRole('link', { name: 'Share via Email' })
      .getAttribute('href')
    // mailto: with no recipient — href should start with "mailto:?" not "mailto:someone@..."
    expect(mailtoHref).toMatch(/^mailto:\?/)
  })

  test('description names the client company', async ({ page }) => {
    await goToShareStep(page)
    // The description paragraph on the share screen
    const desc = page.locator('p').filter({ hasText: 'is live in Google Drive' })
    await expect(desc).toContainText('Starbucks')
  })

  test('"Start new proposal" button resets to Draft step', async ({ page }) => {
    await goToShareStep(page)
    page.on('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Start new proposal' }).click()
    await expect(page.getByRole('heading', { name: 'Upload your brief here' })).toBeVisible()
    await expect(page.getByText('Step 1 · Draft')).toBeVisible()
  })
})

// ─── Step 2: Slide Preview Structure ─────────────────────────────────────────

test.describe('Step 2 – Slide Preview Structure', () => {
  test('shows persuasion-engine slide titles in preview', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('The New Reality of Attention')).toBeVisible()
    await expect(page.getByText('Why Most Brand Campaigns Fail Today')).toBeVisible()
  })

  test('shows old titles are replaced — no Challenge or Our Solution', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('The Challenge', { exact: true })).not.toBeVisible()
    await expect(page.getByText('Our Solution', { exact: true })).not.toBeVisible()
  })

  test('does NOT show next steps when Gemini omits them', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('Next Steps')).not.toBeVisible()
  })

  test('shows proof points in preview', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('+102% brand preference lift', { exact: false })).toBeVisible({ timeout: 10000 })
  })

  test('shows custom plan with client name in preview', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('Your Opportunity with Paramount')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Custom Plan for Starbucks', { exact: false })).toBeVisible()
  })

  test('shows core insight / money slide in preview', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('Winning Brands Don\'t Buy Media', { exact: false })).toBeVisible({ timeout: 10000 })
  })

  test('shows cost of inaction slide in preview', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('What This Is Costing You')).toBeVisible({ timeout: 10000 })
  })

  test('shows investment vs impact slide in preview', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('Investment vs Impact')).toBeVisible({ timeout: 10000 })
  })

  test('shows industry insights in cultural shift slide', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('73% social-media-driven', { exact: false })).toBeVisible({ timeout: 10000 })
  })

  test('slide count in preview toolbar matches new persuasion structure', async ({ page }) => {
    // New persuasion structure without nextSteps:
    // cover, cultural_shift, real_problem, cost_of_inaction, core_insight,
    // paramount_advantage, proof, how_it_works, custom_plan, roi_framing, closing = 11
    await goToIterateStep(page)
    await expect(
      page.getByText('The New Reality of Attention', { exact: false })
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/\d+ slides/)).toBeVisible()
    const slidesText = await page.getByText(/\d+ slides/).innerText()
    const count = parseInt(slidesText)
    expect(count).toBe(11)
  })

  test('shows next steps slide when Gemini returns them', async ({ page }) => {
    let callCount = 0
    await page.route('**/api/gemini/generate-content', (route) => {
      callCount++
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: callCount === 1 ? geminiContentWithApproachBody() : geminiIterationBody(),
      })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await page.getByRole('button', { name: 'Continue to Refine' }).click()
    await expect(
      page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
    ).toBeVisible({ timeout: 10000 })

    await expect(page.getByText('Next Steps')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('From Idea to Cultural Moment')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Identify the cultural moment', { exact: false })).toBeVisible()
  })

  test('slide count increases by 1 when next steps are present', async ({ page }) => {
    let callCount = 0
    await page.route('**/api/gemini/generate-content', (route) => {
      callCount++
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: callCount === 1 ? geminiContentWithApproachBody() : geminiIterationBody(),
      })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await page.getByRole('button', { name: 'Continue to Refine' }).click()
    await expect(
      page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
    ).toBeVisible({ timeout: 10000 })

    await expect(page.getByText('Next Steps')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/\d+ slides/)).toBeVisible()
    const slidesText = await page.getByText(/\d+ slides/).innerText()
    const count = parseInt(slidesText)
    // 11 base + 1 next steps = 12
    expect(count).toBe(12)
  })
})

// ─── Error & auth failure scenarios ─────────────────────────────────────────

test.describe('Error and auth failure scenarios', () => {
  /** Sets up a mock window.google that immediately returns an auth error (simulates denied/closed popup) */
  async function mockGoogleOAuthDenied(page: Page) {
    await page.route('**/accounts.google.com/gsi/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    })
    await page.addInitScript(function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: function (config: { callback: (r: Record<string, unknown>) => void }) {
              return {
                requestAccessToken: function () {
                  // Simulate user closing the popup — GIS reports this via callback with error field
                  config.callback({ error: 'popup_closed', error_description: 'User closed the sign-in popup.' })
                },
              }
            },
            revoke: function () {},
          },
        },
      }
    })
  }

  test('shows auth error when Google sign-in popup is closed', async ({ page }) => {
    await mockGeminiApi(page)
    await mockGoogleOAuthDenied(page)

    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await page.getByRole('button', { name: 'Continue to Refine' }).click()
    await expect(
      page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
    ).toBeVisible({ timeout: 10000 })

    await page.getByLabel('Create Google Slides presentation').click()

    // Error UI must appear — auth was denied
    await expect(page.getByText(/session expired|cancelled/i).first()).toBeVisible({ timeout: 10000 })
    // Try again button should be present so the user can recover
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('shows rate limit error when Drive upload returns 429', async ({ page }) => {
    await mockGeminiApi(page)
    await mockGoogleOAuth(page)

    // Block GIS noise
    await page.route('**/*favicon*', (route) => {
      route.fulfill({ status: 200, contentType: 'image/png', body: '' })
    })

    // Drive upload returns 429 — pptxExport throws RATE_LIMITED
    await page.route('https://www.googleapis.com/**drive**', (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Quota exceeded' } }),
      })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await page.getByRole('button', { name: 'Continue to Refine' }).click()
    await expect(
      page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
    ).toBeVisible({ timeout: 10000 })

    await page.getByLabel('Create Google Slides presentation').click()

    // Rate limit message should appear
    await expect(page.getByText(/rate limit|Please wait/i)).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  })

  test('recovers and proceeds after initial auth failure followed by success', async ({ page }) => {
    // First click: auth denied. Second click: auth succeeds.
    await mockGeminiApi(page)
    await mockGoogleOAuthDenied(page)   // starts with denied mock
    await mockGoogleSlidesApi(page)

    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await page.getByRole('button', { name: 'Continue to Refine' }).click()
    await expect(
      page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
    ).toBeVisible({ timeout: 10000 })

    // First attempt — fails with auth error
    await page.getByLabel('Create Google Slides presentation').click()
    await expect(page.getByText(/session expired|cancelled/i).first()).toBeVisible({ timeout: 10000 })

    // Swap in the success auth mock via page.evaluate (no page reload needed)
    await page.evaluate(function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: function (config: { callback: (r: Record<string, unknown>) => void }) {
              return {
                requestAccessToken: function () {
                  config.callback({ access_token: 'fake-test-token', expires_in: 3600 })
                },
              }
            },
            revoke: function () {},
          },
        },
      }
    })

    // Second attempt via "Try again" — should now succeed
    await page.getByRole('button', { name: /try again/i }).click()
    await page.getByLabel('Create Google Slides presentation').click()
    await expect(page.getByText('Presentation created!')).toBeVisible({ timeout: 15000 })
  })
})

// ─── Resilience Hardening ──────────────────────────────────────────────────

test.describe('Resilience Hardening', () => {
  test('Gemini 503 → fetchWithRetry recovers on second attempt', async ({ page }) => {
    let geminiCallCount = 0
    await page.route('**/api/gemini/generate-content', (route) => {
      geminiCallCount++
      if (geminiCallCount === 1) {
        route.fulfill({ status: 503, contentType: 'text/plain', body: 'Service Unavailable' })
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: geminiContentBody() })
      }
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await page.getByRole('button', { name: 'Continue to Refine' }).click()

    // Wait for generated persuasion slide text (proves the retry succeeded)
    await expect(
      page.getByText('73% social-media-driven', { exact: false })
    ).toBeVisible({ timeout: 30000 })
    expect(geminiCallCount).toBeGreaterThanOrEqual(2)
  })

  test('Gemini 429 rate limit → backs off and recovers on third call', async ({ page }) => {
    let geminiCallCount = 0
    await page.route('**/api/gemini/generate-content', (route) => {
      geminiCallCount++
      if (geminiCallCount <= 2) {
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Resource exhausted' } }),
        })
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: geminiContentBody() })
      }
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await page.getByRole('button', { name: 'Continue to Refine' }).click()

    // Wait for generated persuasion slide text (proves the retry after 429s succeeded)
    await expect(
      page.getByText('73% social-media-driven', { exact: false })
    ).toBeVisible({ timeout: 60000 })
    expect(geminiCallCount).toBeGreaterThanOrEqual(3)
  })

  test('Gemini 200 OK with error body → surfaces actionable error', async ({ page }) => {
    await page.route('**/api/gemini/generate-content', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 429, message: 'Quota exceeded for project' } }),
      })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await page.getByRole('button', { name: 'Continue to Refine' }).click()

    await expect(
      page.getByText(/AI error|Quota exceeded|generation error/i).first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('token expires mid-flow → ensureFreshToken re-auths before Slides creation', async ({ page }) => {
    await page.route('**/accounts.google.com/gsi/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    })

    let tokenCallCount = 0
    await page.addInitScript(function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__tokenCallCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: function (config: { callback: (r: Record<string, unknown>) => void }) {
              return {
                requestAccessToken: function () {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (window as any).__tokenCallCount++;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const count = (window as any).__tokenCallCount;
                  if (count === 1) {
                    config.callback({ access_token: 'short-lived-token', expires_in: 5 })
                  } else {
                    config.callback({ access_token: 'fresh-token-' + count, expires_in: 3600 })
                  }
                },
              }
            },
            revoke: function () {},
          },
        },
      }
    })

    await mockGeminiApi(page)
    await mockGoogleSlidesApi(page)

    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await page.getByRole('button', { name: 'Continue to Refine' }).click()
    await expect(
      page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
    ).toBeVisible({ timeout: 10000 })

    await page.getByLabel('Create Google Slides presentation').click()
    await expect(page.getByText('Presentation created!')).toBeVisible({ timeout: 15000 })

    tokenCallCount = await page.evaluate(() => (window as any).__tokenCallCount)
    expect(tokenCallCount).toBeGreaterThanOrEqual(2)
  })

  test('export succeeds via Drive pptx-upload path (happy path with token counter)', async ({ page }) => {
    await page.route('**/accounts.google.com/gsi/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    })

    await page.addInitScript(function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__tokenCallCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: function (config: { callback: (r: Record<string, unknown>) => void }) {
              return {
                requestAccessToken: function () {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (window as any).__tokenCallCount++;
                  config.callback({ access_token: 'token-' + (window as any).__tokenCallCount, expires_in: 3600 })
                },
              }
            },
            revoke: function () {},
          },
        },
      }
    })

    await mockGeminiApi(page)

    // Drive API succeeds — matches both /drive/** and /upload/drive/** paths
    await page.route('https://www.googleapis.com/**drive**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'fake-presentation-id',
          webViewLink: 'https://docs.google.com/presentation/d/fake-presentation-id/edit',
        }),
      })
    })

    await page.route('**/*favicon*', (route) => {
      route.fulfill({ status: 200, contentType: 'image/png', body: '' })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await page.getByRole('button', { name: 'Continue to Refine' }).click()
    await expect(
      page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
    ).toBeVisible({ timeout: 10000 })

    await page.getByLabel('Create Google Slides presentation').click()
    await expect(page.getByText('Presentation created!')).toBeVisible({ timeout: 20000 })

    // Auth was requested at least once during the export flow
    const tokenCallCount = await page.evaluate(() => (window as any).__tokenCallCount)
    expect(tokenCallCount).toBeGreaterThanOrEqual(1)
  })

  test('full happy path regression (Draft → Refine → Chat → Export → Share)', async ({ page }) => {
    await mockGeminiApi(page)
    await mockGoogleOAuth(page)
    await mockGoogleSlidesApi(page)

    await page.goto('/')

    // Step 1: Paste brief
    await page.getByRole('button', { name: 'Prompt' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await expect(page.getByRole('button', { name: 'Continue to Refine' })).toBeVisible()

    // Step 2: Navigate to Refine
    await page.getByRole('button', { name: 'Continue to Refine' }).click()
    await expect(
      page.locator('[class*="rounded-2xl"]').filter({ hasText: "I've reviewed the brief for" }).first()
    ).toBeVisible({ timeout: 10000 })

    // Step 3: Chat interaction
    await page.getByRole('button', { name: 'Suggest: More concise' }).click()
    const replyBubble = page.locator('[class*="rounded-2xl"]').filter({
      hasText: "I've tightened the language across all sections"
    }).first()
    await expect(replyBubble).toBeVisible({ timeout: 10000 })

    // Step 4: Export to Google Slides
    await page.getByLabel('Create Google Slides presentation').click()

    // Step 5: Verify Share screen
    await expect(page.getByText('Presentation created!')).toBeVisible({ timeout: 15000 })
    const link = page.getByRole('link', { name: 'Open in Google Slides' })
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    expect(href).toContain('fake-presentation-id')
  })
})
