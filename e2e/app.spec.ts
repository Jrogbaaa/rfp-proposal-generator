import { test, expect, type Page } from '@playwright/test'

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
            updatedExpansions: {
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
  await page.route('**/generativelanguage.googleapis.com/**', (route) => {
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
  await page.route('**/slides.googleapis.com/**', (route) => {
    if (route.request().url().includes(':batchUpdate')) {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    } else {
      // Create presentation — return a fake presentationId
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
  await page.getByRole('button', { name: 'Paste Text' }).click()
  await page.locator('textarea').fill(SAMPLE_BRIEF)
  await page.getByRole('button', { name: 'Continue to Refine' }).click()
  await expect(
    page.locator('[class*="rounded-2xl"]').filter({ hasText: "Hi! I've reviewed the brief for" }).first()
  ).toBeVisible({ timeout: 10000 })
}

/** Navigate all the way to the Share (step 3) with all APIs mocked */
async function goToShareStep(page: Page) {
  await mockGeminiApi(page)
  await mockGoogleOAuth(page)   // must come before page.goto
  await mockGoogleSlidesApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Paste Text' }).click()
  await page.locator('textarea').fill(SAMPLE_BRIEF)
  await page.getByRole('button', { name: 'Continue to Refine' }).click()
  await expect(
    page.locator('[class*="rounded-2xl"]').filter({ hasText: "Hi! I've reviewed the brief for" }).first()
  ).toBeVisible({ timeout: 10000 })
  await page.getByLabel('Create Google Slides presentation').click()
  await expect(page.getByText('Presentation created!')).toBeVisible({ timeout: 15000 })
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

  test('switches to Paste Text mode', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Paste Text' }).click()
    await expect(page.locator('textarea')).toBeVisible()
    await expect(page.getByText('Paste your RFP or brief text below')).toBeVisible()
  })

  test('switches back to Upload PDF mode', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Paste Text' }).click()
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
    await page.getByRole('button', { name: 'Paste Text' }).click()
    await page.locator('textarea').fill(SAMPLE_BRIEF)
    await expect(page.getByText('Brief parsed')).toBeVisible()
  })

  test('parsed fields (Company, Project, Timeline, Budget) appear in preview', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Paste Text' }).click()
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
    await page.getByRole('button', { name: 'Paste Text' }).click()
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

  test('right sidebar shows Refine Content label and chat input', async ({ page }) => {
    await goToIterateStep(page)
    await expect(page.getByText('Refine Content', { exact: true })).toBeVisible()
    await expect(page.locator('textarea[placeholder*="Ask for changes"]')).toBeVisible()
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
    const greeting = page.locator('[class*="rounded-2xl"]').filter({ hasText: "Hi! I've reviewed the brief for" }).first()
    await expect(greeting).toBeVisible()
  })

  test('greeting references the client company name', async ({ page }) => {
    await goToIterateStep(page)
    const greeting = page.locator('[class*="rounded-2xl"]').filter({ hasText: "Hi! I've reviewed the brief for" }).first()
    await expect(greeting).toContainText('Starbucks')
  })

  test('shows all 6 suggested prompts on first load', async ({ page }) => {
    await goToIterateStep(page)
    for (const prompt of [
      'Make it more concise',
      'Add stronger ROI focus',
      'Use a more formal tone',
      'Make it more persuasive',
      'Highlight urgency',
      'Add specific metrics',
    ]) {
      await expect(page.getByRole('button', { name: prompt })).toBeVisible()
    }
  })

  test('chat textarea has correct placeholder text', async ({ page }) => {
    await goToIterateStep(page)
    await expect(
      page.locator('textarea[placeholder*="Ask for changes"]')
    ).toBeVisible()
  })

  test('clicking a suggested prompt sends the message', async ({ page }) => {
    await goToIterateStep(page)
    await page.getByRole('button', { name: 'Make it more concise' }).click()
    // User message bubble appears
    const userBubble = page.locator('[class*="bg-navy-700"]').filter({ hasText: 'Make it more concise' })
    await expect(userBubble).toBeVisible()
  })

  test('AI responds after a suggested prompt is sent', async ({ page }) => {
    await goToIterateStep(page)
    await page.getByRole('button', { name: 'Make it more concise' }).click()
    // AI reply from mock — wait for the assistant bubble
    const replyBubble = page.locator('[class*="rounded-2xl"]').filter({
      hasText: "I've tightened the language across all sections"
    }).first()
    await expect(replyBubble).toBeVisible({ timeout: 10000 })
  })

  test('typing a custom message and pressing Enter sends it', async ({ page }) => {
    await goToIterateStep(page)
    const chatTextarea = page.locator('textarea[placeholder*="Ask for changes"]')
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
    await page.getByRole('button', { name: 'Make it more concise' }).click()
    // Wait for AI reply
    await expect(page.locator('[class*="rounded-2xl"]').filter({
      hasText: "I've tightened the language across all sections"
    }).first()).toBeVisible({ timeout: 10000 })
    // Prompts should now be hidden (messages.length > 1)
    await expect(
      page.getByRole('button', { name: 'Add stronger ROI focus' })
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

  test('shows "Share via Outlook" mailto link', async ({ page }) => {
    await goToShareStep(page)
    await expect(page.getByRole('link', { name: 'Share via Outlook' })).toBeVisible()
  })

  test('email body says "Hey team" not "Hi FirstName" or "Hi there"', async ({ page }) => {
    await goToShareStep(page)
    const mailtoHref = await page
      .getByRole('link', { name: 'Share via Outlook' })
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
      .getByRole('link', { name: 'Share via Outlook' })
      .getAttribute('href')
    const decoded = decodeURIComponent(mailtoHref!)
    expect(decoded).toContain('Starbucks')
  })

  test('email body contains the slides URL', async ({ page }) => {
    await goToShareStep(page)
    const mailtoHref = await page
      .getByRole('link', { name: 'Share via Outlook' })
      .getAttribute('href')
    const decoded = decodeURIComponent(mailtoHref!)
    expect(decoded).toContain('fake-presentation-id')
  })

  test('email To: field is blank (intended for internal team, not the client)', async ({ page }) => {
    await goToShareStep(page)
    const mailtoHref = await page
      .getByRole('link', { name: 'Share via Outlook' })
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
    await page.getByRole('button', { name: 'Start new proposal' }).click()
    await expect(page.getByRole('heading', { name: 'Upload your brief here' })).toBeVisible()
    await expect(page.getByText('Step 1 · Draft')).toBeVisible()
  })
})
