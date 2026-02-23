# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **E2E testing with Playwright** — 15 tests covering app shell, input mode toggle, brief editor, document preview, Google Slides button, and PDF uploader
  - `e2e/app.spec.ts` — test suite
  - `playwright.config.ts` — Playwright configuration (Chromium, Vite preview server)
  - `npm test`, `npm run test:ui`, `npm run test:headed` scripts
- **GitHub Actions CI** — `.github/workflows/e2e.yml` runs E2E tests on every push and PR to main
  - Uploads Playwright HTML report and failure traces as artifacts

### Fixed
- **App.tsx** — Removed stale `setGeneratedUrl(null)` call in `handleFileUpload` that caused a build failure
- **Paramount branding for Google Slides export**
  - Brand palette switched from navy/gold/cream to Paramount navy (`#0D1F40`) + orange (`#F27321`)
  - Fonts updated: headings use Montserrat (Bold), body uses Inter (replaces Playfair Display + DM Sans)
  - Agency name changed from "Look After You" to "Paramount" on cover and closing slides
- **Auto-fetched brand logos** on cover and closing slides via Clearbit Logo API
  - Paramount logo on cover (top-right) and closing (centered)
  - Client logo on cover (bottom-right), fetched by `companyDomain`
  - Logo insertion is best-effort — failures don't break the presentation
- **`companyDomain` field** added to `ClientInfo` type and both intake forms (StructuredForm, TranscriptInput)
- **Text autofit** (`TEXT_AUTOFIT`) applied to every text box across all slides — text auto-shrinks to fit containers

### Fixed
- **Slide text overlap** — `problemDeepDive` headline box enlarged (700K → 1M EMU), font reduced (30pt → 24pt), body pushed down (y 1.5M → 1.65M EMU); same fix applied to `problemsCombined` two-column layout

### Added (prior)
- **Google Slides API integration** — replaces manual Gamma.app workflow
  - `src/utils/googleAuth.ts` — OAuth 2.0 token management via Google Identity Services (GIS)
  - `src/utils/googleSlides.ts` — Google Slides REST API client using two-phase batchUpdate approach
  - `src/components/GoogleSlidesButton.tsx` — self-contained button with 5-step animated progress, OAuth popup, and "Open in Google Slides" success link
  - `VITE_GOOGLE_CLIENT_ID` environment variable for OAuth Client ID
  - GIS library script tag added to `index.html`
  - `window.google` type declarations added to `src/vite-env.d.ts`
- Documenter sub-agent system for automatic change tracking
- Error handling utilities for local development - `src/utils/errorHandler.ts`
- ErrorBoundary component for React error catching - `src/components/ErrorBoundary.tsx`
- DevTools floating panel for error viewing - `src/components/DevTools.tsx`
- Global error handlers in main.tsx (window.onerror, unhandledrejection)
- Internal documentation structure (`docs/`)
- Documenter directive - `directives/documenter.md`
- **GammaPromptGenerator component** - `src/components/GammaPromptGenerator.tsx`
  - Generates tailored Gamma presentation prompts from client brief data
  - Smart prompt builder that responds to client's budget, challenges, and goals
  - Includes creative strategies (social media, video storytelling, experiential marketing, etc.)
  - Copy-to-clipboard functionality for easy transfer to gamma.app
  - Expandable UI with preview of generated prompt
  - Added alongside GenerateButton with "or" divider in App.tsx
- **LLM Service** - `src/utils/llmService.ts` - OpenAI GPT-4o integration for personalized proposal content generation
- `VITE_OPENAI_API_KEY` environment variable for OpenAI API authentication

### Changed
- **App.tsx** — Replaced `GammaPromptGenerator` with `GoogleSlidesButton` (direct API integration replaces manual copy-paste Gamma workflow); added `briefText` prop forwarding
- **GammaPromptGenerator.tsx** - Replaced generic prompt with coffee-themed 10-slide creative agency deck template branded for "Look After You"
  - Agency identity: Prompt now explicitly presents as "Look After You" agency
  - Uses coffee metaphors throughout (brew, blend, roast, espresso shot, pour-over, etc.)
  - Fixed 10-slide structure: Executive Brew, The Grind, Look After You's Strategic Approach, Customer Journey Roast, Data Espresso Shot, Personalization Pour-Over, Brew Plan, Investment Recipe, Flavor Profile, Why Look After You
  - Injects client brief data (company, contact, timeline, budget, problems, benefits) dynamically
  - Removed random creative strategies in favor of structured coffee-themed approach
- **useBriefParser.ts** - Extended parser to extract `platformCosts`, `monthOneInvestment`, `monthTwoInvestment`, `monthThreeInvestment` from brief text
- **BriefEditor.tsx** - Updated placeholder example with Starbucks demo brief including all pricing fields
- Updated App.tsx to include ErrorBoundary wrapper and DevTools panel
- Updated main.tsx with global error capturing
- **App.tsx** - Simplified to single generation path (Google Slides only); removed PandaDoc flow, "or" divider, and PandaDoc toasts

### Fixed
- **vite-env.d.ts** — Removed invalid `declare global` wrapper; ambient `.d.ts` files augment `Window` directly. Resolved 5× TS2339 TypeScript errors on `window.google`.
- **vite.config.ts** — Added `port: 5173, strictPort: true` to prevent OAuth `redirect_uri_mismatch` errors caused by the dev server silently bumping to a different port when 5173 is occupied.

### Removed
- **PandaDoc integration fully removed** — `src/utils/pandadoc.ts`, `src/components/GenerateButton.tsx`, `src/components/SuccessScreen.tsx` deleted; PandaDoc imports, state, `handleGenerate`, `buildProposalData`, proxy config, and env vars all stripped; Google Slides is now the sole presentation output
- **GammaPromptGenerator** removed from `App.tsx` (component file retained but no longer rendered; replaced by `GoogleSlidesButton`)

---

## How This Works

The Documenter sub-agent automatically reviews changes after each modification and logs them here. Each entry includes:
- **What changed**: Component, file, or feature affected
- **Why it changed**: Brief rationale
- **Impact**: Any side effects or dependencies affected
