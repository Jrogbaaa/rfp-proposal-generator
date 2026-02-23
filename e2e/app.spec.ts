import { test, expect } from '@playwright/test'

const SAMPLE_BRIEF = `Project: Digital Customer Experience Transformation
Client: Sarah Martinez, sarah.martinez@starbucks.com, Starbucks
Timeline: 4 months
Budget: $175,000

Problems:
- Mobile app engagement has dropped 23% since last quarter
- Customer loyalty program data is siloed across multiple systems

Benefits:
- Real-time unified customer view across all touchpoints
- 15-20% lift in mobile app engagement within 90 days`

test.describe('App Shell', () => {
  test('loads with header, input panel, and output panel', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('header')).toBeVisible()
    await expect(page.getByText('Google Slides Ready')).toBeVisible()
    await expect(page.getByText('Input')).toBeVisible()
    await expect(page.getByText('Output')).toBeVisible()
  })

  test('header shows connection status and action buttons', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Google Slides Ready')).toBeVisible()
    await expect(page.getByText('New')).toBeVisible()
  })
})

test.describe('Input Mode Toggle', () => {
  test('defaults to Paste Brief mode', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Paste Your Brief')).toBeVisible()
    await expect(page.locator('textarea')).toBeVisible()
  })

  test('switches to Upload PDF mode', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Upload PDF' }).click()

    await expect(page.getByText('Upload Document')).toBeVisible()
    await expect(page.getByText('Drop your PDF here')).toBeVisible()
  })

  test('switches back to Paste Brief mode', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Upload PDF' }).click()
    await expect(page.getByText('Upload Document')).toBeVisible()

    await page.getByRole('button', { name: 'Paste Brief' }).click()
    await expect(page.getByText('Paste Your Brief')).toBeVisible()
    await expect(page.locator('textarea')).toBeVisible()
  })
})

test.describe('Brief Editor', () => {
  test('typing updates character count', async ({ page }) => {
    await page.goto('/')

    const textarea = page.locator('textarea')
    await textarea.fill('Hello World')

    await expect(page.getByText('11')).toBeVisible()
    await expect(page.getByText('characters')).toBeVisible()
  })

  test('clear button resets the editor', async ({ page }) => {
    await page.goto('/')

    const textarea = page.locator('textarea')
    await textarea.fill('Some text')

    const clearButton = page.getByRole('button', { name: 'Clear' }).first()
    await clearButton.click()

    await expect(textarea).toHaveValue('')
  })

  test('shows placeholder text when empty', async ({ page }) => {
    await page.goto('/')

    const textarea = page.locator('textarea')
    await expect(textarea).toHaveAttribute('placeholder', /Paste your proposal brief here/)
  })
})

test.describe('Document Preview', () => {
  test('shows empty state when no brief is entered', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('No document yet')).toBeVisible()
    await expect(page.getByText('Paste your proposal brief on the left')).toBeVisible()
  })

  test('shows parsed proposal after entering a brief', async ({ page }) => {
    await page.goto('/')

    await page.locator('textarea').fill(SAMPLE_BRIEF)

    await expect(page.getByText('Digital Customer Experience Transformation')).toBeVisible()
    await expect(page.getByText('Starbucks')).toBeVisible()
  })

  test('preview tabs are clickable', async ({ page }) => {
    await page.goto('/')
    await page.locator('textarea').fill(SAMPLE_BRIEF)

    await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Structure' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()

    await page.getByRole('button', { name: 'Structure' }).click()
    await page.getByRole('button', { name: 'Preview' }).click()
  })
})

test.describe('Google Slides Button', () => {
  test('is disabled when no brief text is entered', async ({ page }) => {
    await page.goto('/')

    const button = page.getByRole('button', { name: /Create Google Slides/i })
    await expect(button).toBeVisible()
    await expect(button).toBeDisabled()
  })

  test('becomes enabled after entering brief text', async ({ page }) => {
    await page.goto('/')

    await page.locator('textarea').fill(SAMPLE_BRIEF)

    const button = page.getByRole('button', { name: /Create Google Slides/i })
    await expect(button).toBeEnabled()
  })

  test('shows helper hint when brief is entered', async ({ page }) => {
    await page.goto('/')

    await page.locator('textarea').fill(SAMPLE_BRIEF)

    await expect(page.getByText('Creates a 10-slide presentation')).toBeVisible()
  })
})

test.describe('PDF Uploader', () => {
  test('shows drop zone with instructions', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Upload PDF' }).click()

    await expect(page.getByText('Drop your PDF here')).toBeVisible()
    await expect(page.getByText('or click to browse')).toBeVisible()
    await expect(page.getByText('No file selected')).toBeVisible()
  })
})
