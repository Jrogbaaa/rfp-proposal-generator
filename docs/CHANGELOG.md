# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-02-26]

### Added
- **Gemini multimodal PDF analysis** — `src/utils/llmService.ts`; new `analyzeBriefPdf(file: File): Promise<string>` function uses Gemini's `inline_data` multimodal API to send the entire PDF as base64-encoded data; Gemini Vision reads every page (text, images, logos, brand colors) and returns structured brief text covering client info, project details, problems, benefits, and brand visual notes; new `fileToBase64()` helper handles the File → base64 conversion
- **4-step app flow: Draft → Iteration → Design → Share** — `src/App.tsx` fully restructured; `ProgressStepper.tsx` now wired in with a fixed step-nav bar below the header
- **Real PDF extraction via Gemini Vision** — `src/components/PdfUploader.tsx` now calls `analyzeBriefPdf()` directly instead of a fake processing animation; three real loading stages: "Uploading to Gemini" → "Extracting structure & content" → "Building brief from PDF"; extracted text feeds into `useBriefParser` automatically via `onTextExtracted` callback prop; shows actual error messages on failure instead of silent failure
- **`ChatInterface` component** — `src/components/ChatInterface.tsx` (new file); Step 2 chatbot for multi-turn AI content iteration; users request tone/language/focus changes; Gemini refines `problemExpansions` + `benefitExpansions` inline with conversation history; suggested prompt chips pre-populate common requests; fires `onExpansionsUpdated` callback
- **`iterateProposalContent()` LLM function** — `src/utils/llmService.ts`; accepts brief, parsed data, current expansions, instruction, and conversation history; returns `{reply, updatedExpansions?}`; also exports new `ChatMessage` interface for multi-turn history
- **Live slide preview with real data (Step 3)** — `src/components/SlidePreview.tsx` updated; `data?: Partial<ProposalData>` prop added; `buildSlidesFromData()` generates 10 slide cards from real proposal content; falls back to T-Mobile static demo when no real data is present
- **Outlook mailto share (Step 4)** — share step renders `mailto:` link pre-filled with client email, subject `RFP: {project}`, and body containing Google Slides URL; no API integration required
- **`onSuccess` callback on `GoogleSlidesButton`** — triggers step advance to Share on successful slide creation; `preGeneratedContent` prop skips LLM re-call when chatbot already generated expansions

### Changed
- **`PdfUploader` replaces fake animation with real Gemini Vision extraction** — `src/components/PdfUploader.tsx`; previously showed a fake progress animation that never read the file; now calls `analyzeBriefPdf()` and surfaces real loading stages and error messages; `onTextExtracted` callback prop added
- **`SlidePreview` accepts real proposal data** — `src/components/SlidePreview.tsx`; updated to accept `data?: Partial<ProposalData>` prop; previously rendered only static content
- **`GoogleSlidesButton` extended with new props** — `src/components/GoogleSlidesButton.tsx`; added `preGeneratedContent` (skips redundant LLM call when ChatInterface already ran) and `onSuccess` callback (advances to Share step on completion)
- **`Step` type updated** — `src/types/proposal.ts`; `Step` union type changed from previous values to `'draft' | 'iterate' | 'design' | 'share'`; `STEPS` array updated accordingly
- **`useProposalState` hook updated** — `src/hooks/useProposalState.ts`; minor updates to align with new step types and multi-step flow

---

## [Unreleased]

### Changed
- **Cover slide redesigned: right-panel split layout** — `src/utils/googleSlides.ts`
  - Removed decorative `ELLIPSE` blobs from cover and closing slides
  - Cover slide split into left content zone (65%) and branded right panel (35%, `NAVY_LIGHTER`)
  - Thin orange vertical accent line divides the two zones
  - Client and Paramount logos now live inside the right panel: stacked vertically, centered, with labels (`STARBUCKS` / `PARAMOUNT`) and an orange horizontal rule between them — drawn in Phase 2 as structural elements, logos inserted in Phase 3
  - All text content constrained to `CONTENT_W` (left 65%) so it never bleeds into the panel
  - Closing slide: ellipse removed; two thin orange horizontal rules now bracket the CTA text
  - New module-level layout constants: `PANEL_X`, `PANEL_W`, `CONTENT_W`, `LOGO_SIZE`, `LOGO_X`, `COVER_CLABEL_Y`, `COVER_CLOGO_Y`, `COVER_DIV_Y`, `COVER_PLABEL_Y`, `COVER_PLOGO_Y` — keeps Phase 2 labels/divider and Phase 3 images pixel-aligned
- **Switched LLM from OpenAI GPT-4o to Google Gemini 2.5 Flash** — `src/utils/llmService.ts` now calls the Gemini REST API instead of OpenAI; uses `responseMimeType: "application/json"` for native JSON output; env var changed from `VITE_OPENAI_API_KEY` to `VITE_GEMINI_API_KEY`; `src/vite-env.d.ts` updated accordingly
- **Removed TEXT_AUTOFIT from Google Slides** — Google Slides API no longer supports `autofitType: 'TEXT_AUTOFIT'`; removed the `autofit()` helper and all 23 call sites in `src/utils/googleSlides.ts` to fix `400 Autofit types other than NONE are not supported` error

### Added
- **E2E testing with Playwright** — 15 tests covering app shell, input mode toggle, brief editor, document preview, Google Slides button, and PDF uploader
  - `e2e/app.spec.ts` — test suite
  - `playwright.config.ts` — Playwright configuration (Chromium, Vite preview server)
  - `npm test`, `npm run test:ui`, `npm run test:headed` scripts
- **GitHub Actions CI** — `.github/workflows/e2e.yml` runs E2E tests on every push and PR to main
  - Uploads Playwright HTML report and failure traces as artifacts

### Fixed
- **Google Slides `updateShapeProperties` autofit field mask** — Changed `fields: 'autofit'` to `fields: 'autofit.autofitType'` in `googleSlides.ts` to avoid including read-only subfields (`fontScale`, `lineSpacingReduction`) that caused `400 Invalid field mask: * includes read-only fields` on batchUpdate request #19
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
- **LLM Service** - `src/utils/llmService.ts` - personalized proposal content generation (originally OpenAI GPT-4o, now Gemini 2.0 Flash)
- `VITE_GEMINI_API_KEY` environment variable for Gemini API authentication (previously `VITE_OPENAI_API_KEY`)

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
