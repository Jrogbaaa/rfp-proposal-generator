# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-03-03] — Refine Step UI Overhaul & Sticky Sidebar

### Added
- **Inline slide title editing** — `src/components/SlidePreview.tsx`; clicking the title on editable slides (3, 4, 7, 8 and any AI-added slides) shows a transparent inline `<input>` matching the title font; saves on blur or Enter; wired to new `handleSlideTitleEdit` in `App.tsx` which stores overrides in `expansions.customTitles`
- **"Add more slides" via chat** — `src/utils/llmService.ts`, `src/utils/slideBuilder.ts`, `src/types/proposal.ts`; when the user asks to add slides or make the deck longer, Gemini returns an `additionalSlides` array; new slides are appended after slide 10 and rendered as fully editable cards; bullet and title edits on slides 11+ update `expansions.additionalSlides` in place
- **`AdditionalSlide` interface** — `src/types/proposal.ts`; `{ title: string; bullets: string[] }`
- **`additionalSlides` and `customTitles` fields on `ExpandedContent`** — `src/types/proposal.ts`; both optional; `customTitles` stores per-slide title overrides keyed by slide number

### Changed
- **Right sidebar is now sticky** — `src/App.tsx`; the Refine step right panel uses `lg:sticky lg:top-[8.5rem] lg:h-[calc(100vh-8.5rem)]`; the "Refine Content" label, chat, and export button stay locked in the viewport while the slide preview scrolls freely on the left
- **Design tab removed from Refine step** — `src/App.tsx`; the Content/Design tab toggle and `DesignChatInterface` are removed; the panel now shows a "Refine Content" label and renders `ChatInterface` directly; `sidebarTab` state removed; export button always visible
- **"Disconnected" badge hidden** — `src/components/Header.tsx`; the red "Disconnected" status badge is no longer shown; the "Google Slides Ready" badge only appears when the user is authenticated
- **Flat inline bullet editing** — `src/components/SlidePreview.tsx`; clicking editable bullet text now shows a transparent, borderless `<textarea>` that blends into the slide face instead of a gold-bordered box
- **`ITERATE_SYSTEM_PROMPT` updated** — `src/utils/llmService.ts`; added instructions for generating `additionalSlides`; redirects design change requests instead of slide-count requests; preserves `customTitles` and `additionalSlides` across content refinement passes
- **`buildSlidesFromData` updated** — `src/utils/slideBuilder.ts`; applies `customTitles` overrides to slides 3, 4, 7, 8; appends `additionalSlides` after the closing slide
- **`googleSlides.ts` null-safety** — `src/utils/googleSlides.ts`; guards `insertText` calls for `client.company`, `project.title`, `problems`, `benefits`, and `slideFooter` against empty strings to prevent batch request failures

### Fixed
- **E2E tests updated** — `e2e/app.spec.ts`; "loads with header and connection badge" → "loads with header and New button" (no Disconnected badge); "right sidebar shows Content tab" → "right sidebar shows Refine Content label"

---

## [2026-02-27] — CI E2E Fix: Missing Build-Time Env Vars

### Fixed
- **12 E2E test failures in GitHub Actions** — `.github/workflows/e2e.yml`; the CI build step ran `npm run build` without `VITE_GEMINI_API_KEY` or `VITE_GOOGLE_CLIENT_ID`, so Vite compiled both to `undefined`; guard checks in `llmService.ts` and `googleAuth.ts` threw before any `fetch()` call, preventing Playwright route mocks from intercepting; added dummy env vars (`test-api-key`, `test-client-id.apps.googleusercontent.com`) to the build step — actual values are irrelevant since all API calls are mocked in tests

### Added
- **`.env.example`** — documents required `VITE_GEMINI_API_KEY` and `VITE_GOOGLE_CLIENT_ID` environment variables for new contributors

---

## [2026-02-27] — Brand Voice Training & Proposal Playbook

### Added
- **`BrandVoicePanel` component** — `src/components/BrandVoicePanel.tsx`; collapsible panel on Step 1 right side; accepts multiple PDF uploads; shows "Trained on X docs" badge when active; persists extracted voice guide in `localStorage` (`rfp_brand_voice` + `rfp_brand_voice_count`) so training survives page refreshes; includes staging area, drag-and-drop, 3-stage loading animation, voice preview snippet, and "Clear training" / "Retrain" actions
- **`extractBrandVoice(files: File[])` LLM function** — `src/utils/llmService.ts`; accepts multiple PDFs; routes small batches (< 15 MB total) via inline_data, larger batches via Gemini Files API; sends all files in a single Gemini call with `BRAND_VOICE_PROMPT`; cleans up uploaded URIs in finally block; returns a 200–400 word plain-prose brand voice guide
- **`PARAMOUNT_TRAINING_CONTEXT` constant** — `src/utils/trainingContext.ts`; pre-seeded playbook derived from 5 real Paramount documents (Dunkin' 2026 Content Day proposal, Under Armour Q1'26 GRAMMYs proposal, U.S. Army FY26 HPP brief, T-Mobile FY25/26 Upfront brief, Under Armour Q4 Flag Football brief); covers 5 brief archetypes (QSR/Entertainment, Sports/Performance, Government/Recruitment, Telecom/Tech Lifestyle, Women's Sport/Cultural Moment) each with incoming brief signals and Paramount's winning response approach; injected into every generation call automatically

### Changed
- **`generateProposalContent()` system prompt** — `src/utils/llmService.ts`; now injects `PARAMOUNT_TRAINING_CONTEXT` (always-on) and optional `brandVoice` guide before the existing `SYSTEM_PROMPT`; accepts new `brandVoice?: string` parameter
- **`iterateProposalContent()` system prompt** — `src/utils/llmService.ts`; same pattern as above — injects training context and optional brand voice into `ITERATE_SYSTEM_PROMPT`; accepts new `brandVoice?: string` parameter
- **`ChatInterface` props** — `src/components/ChatInterface.tsx`; added `brandVoice?: string` prop; forwarded to `iterateProposalContent()` calls; added to `useCallback` dependency array
- **`App.tsx` Step 1 right panel** — `src/App.tsx`; added `brandVoice` state initialised from `localStorage`; renders `<BrandVoicePanel>` above the brief preview section; passes `brandVoice` to `generateProposalContent()` (initial generation + retry) and to `<ChatInterface>`

---

## [2026-02-27] — PDF Robustness & E2E Fixes

### Added
- **Gemini Files API path for large PDFs** — `src/utils/llmService.ts`; PDFs > 15MB now upload via `POST /upload/v1beta/files` (multipart) instead of base64 inline_data; the inference request references the file by `file_uri`; uploaded files are deleted after extraction (non-blocking); files auto-expire after 48h regardless
- **JSON retry path for truncated Gemini responses** — `src/utils/llmService.ts`; if `JSON.parse` fails on the first response (e.g. output token limit truncation), retries once without `responseMimeType: 'application/json'` and strips markdown fences via `extractJsonFromText()`; resolved TMUS PDF (2.5 MB) silently failing with only 157 output tokens
- **`uploadToFilesApi()` helper** — `src/utils/llmService.ts`; constructs multipart/related body with metadata + raw PDF binary; returns `file_uri` string
- **`deleteFilesApiFile()` helper** — `src/utils/llmService.ts`; fire-and-forget `DELETE` call; errors silently ignored
- **`extractJsonFromText()` helper** — `src/utils/llmService.ts`; strips ````json … ```` fences from model output before `JSON.parse`
- **`MAX_PDF_SIZE` constant exported** — `src/utils/llmService.ts`; 50 MB hard limit (Gemini's ceiling); consumed by `PdfUploader`
- **Vision API diagnostic script** — `test-vision.mjs` at project root; standalone Node.js tool that calls Gemini 2.5 Flash directly with the 4 Paramount PDFs; prints extracted fields, brand notes, and a quality score (N/5); confirmed Gemini reads actual photographs (flag football athletes, soldiers) not just text

### Changed
- **`analyzeBriefPdf()` size routing** — `src/utils/llmService.ts`; > 50 MB throws immediately; > 15 MB takes Files API path; ≤ 15 MB uses existing inline_data path
- **`maxOutputTokens` increased to 8192** — `src/utils/llmService.ts`; was 4096; TMUS PDF required more output tokens for complete JSON
- **`PdfUploader` validates file size** — `src/components/PdfUploader.tsx`; added 50 MB check using imported `MAX_PDF_SIZE`; shows user-friendly error message before calling Gemini
- **E2E test helpers updated** — `e2e/app.spec.ts`; `goToIterateStep` and `goToShareStep` now wait for the ChatInterface greeting bubble (`"Hi! I've reviewed the brief for"`) instead of the stale `"Ask for changes"` heading text that was removed in the sidebar redesign
- **E2E connection badge test fixed** — `e2e/app.spec.ts`; `loads with header and connection badge` now matches `/Google Slides Ready|Disconnected/` regex to handle CI environments where OAuth is unavailable
- **E2E sidebar headings test updated** — `e2e/app.spec.ts`; `right sidebar shows Content tab and chat input` replaces the stale `"Refine with AI"` / `"Ask for changes"` heading assertions with `Content` tab button and `textarea[placeholder*="Ask for changes"]`

---

## [2026-02-26] — Workflow Audit

### Added
- **Design theme picker in Refine step** — `src/App.tsx`; Content/Design tab toggle in the right sidebar lets users switch between content refinement chat and design theme chat; `DesignChatInterface` now integrated and functional
- **`DesignChatInterface` component** — `src/components/DesignChatInterface.tsx`; Gemini-powered chat for selecting color themes; parses model response to extract `{ reply, designConfig }` JSON; embeds `GoogleSlidesButton` for one-click export; 6 suggested prompts; shows current theme badge (Navy & Gold / Slate & Blue / Forest Green)
- **`ColorTheme` + `DesignConfig` types** — `src/types/proposal.ts`; `ColorTheme = 'navy-gold' | 'slate-blue' | 'forest-green'`; `DesignConfig = { colorTheme: ColorTheme }`; `DEFAULT_DESIGN_CONFIG` exported; `designConfig` state added to `App.tsx`
- **`iterateDesign()` LLM function** — `src/utils/llmService.ts`; accepts `currentDesignConfig`, `userInstruction`, and `history`; sends system prompt that maps natural language to one of three themes; returns `{ reply: string; designConfig?: DesignConfig }` via Gemini JSON mode (temperature 0.5)
- **Palette theming in Google Slides** — `src/utils/googleSlides.ts`; added `SlidePalette` interface (`primary`, `primaryLighter`, `primaryDarker`, `accent` — all `RgbColor`) and `PALETTE_MAP: Record<ColorTheme, SlidePalette>` with three theme entries (navy-gold, slate-blue, forest-green); all 7 slide-builder functions (`titleSlide`, `challengeSlide`, `problemDeepDive`, `problemsCombined`, `solutionSlide`, `investmentSlide`, `closingSlide`) now accept `palette: SlidePalette`; `createGoogleSlidesPresentation` resolves palette from optional `designConfig` at call site
- **`ThemeTokens` + `THEME_MAP` in SlidePreview** — `src/components/SlidePreview.tsx`; `ThemeTokens` interface maps 6 Tailwind slot names (`accentBar`, `badgeBg`, `badgeText`, `title`, `subtitle`, `bullet`) to class strings; `THEME_MAP` covers all three `ColorTheme` values; `SlideCard` accepts `theme?: ThemeTokens` so HTML preview and Google Slides export stay visually in sync
- **Error state + retry for AI generation** — `src/App.tsx`; if Gemini content generation fails, shows error panel with retry and back-to-draft buttons instead of infinite skeleton
- **`slideBuilder.ts` utility** — `src/utils/slideBuilder.ts`; `buildSlidesFromData()` extracted from `SlidePreview.tsx` to fix HMR Fast Refresh warnings
- **Real Google auth state** — `src/App.tsx`; Header `isConnected` badge now reflects actual OAuth state via `getAuthState()` polling

### Changed
- **Removed T-Mobile demo deck as fallback** — `src/components/SlidePreview.tsx`; no longer imports `TMOBILE_PARAMOUNT_SLIDES`; shows clean empty state when no brief data exists
- **Cleaned export fallback defaults** — `src/components/GoogleSlidesButton.tsx`; `buildProposalData()` now uses empty strings instead of `'Client'`, `'Company'`, `'$0'`, `'client@example.com'` so missing fields are omitted from exported decks
- **Cleaned preview fallback text** — `src/utils/slideBuilder.ts`; replaced `'Digital Transformation'`, `'TBD'`, `'Problem 1'` etc. with `'—'` or conditional omission
- **Replaced Starbucks placeholder** — `src/components/BriefEditor.tsx`; textarea placeholder now shows generic format guide instead of branded Starbucks example
- **Header wired up** — `src/App.tsx`; `onNew={handleReset}` connected; non-functional Templates/History buttons removed
- **Step navigation guarded** — `src/App.tsx`; `handleStepClick` now prevents forward jumps to incomplete steps
- **Chat history capped** — `src/utils/llmService.ts`; `iterateProposalContent` and `iterateDesign` now send only the last 10 messages to Gemini
- **Step flow collapsed to 3** — `src/types/proposal.ts`; steps are now Draft/Refine/Export (removed standalone Design step)

### Removed
- 9 orphaned legacy files: `DocumentPreview.tsx`, `ContentEditor.tsx`, `StructuredForm.tsx`, `TranscriptInput.tsx`, `InputModeSelector.tsx`, `Layout.tsx`, `GammaPromptGenerator.tsx`, `ProposalReview.tsx`, `useProposalState.ts`
- Non-functional Templates and History header buttons

---

## [2026-02-26] — Previous

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
