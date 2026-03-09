# Changelog

## [2026-03-09] — Scroll-to-Top on Step Transitions

### Fixed
- **`App.tsx` — page now scrolls to top when switching between steps** — Added instant `scrollToTop()` via `requestAnimationFrame` to all step transitions, plus a `useEffect` on `currentStep` as a safety net.
- **`ChatInterface.tsx` / `DesignChatInterface.tsx` — stopped `scrollIntoView` from firing on mount** — The chat components' auto-scroll effect was running on initial render, scrolling the entire page down to the chat panel and hiding the loading bar. Now skips the first render and only auto-scrolls after user interaction. Also changed to `block: 'nearest'` so it scrolls within the chat container instead of the whole page.

---

## [2026-03-06] — Template Design + Direct Population (Clear-and-Fill)

### Changed
- **`googleSlidesTemplate.ts` — replaced placeholder-based content injection with clear-and-fill approach** — Removed `buildReplaceRequests()` (which used `replaceAllText` with `{{PLACEHOLDER}}` markers) and `buildStaticTextCleanupRequests()`. Replaced with auto-discovery of slide roles from placeholder patterns, then direct `deleteText` + `insertText` into content shapes. Content now comes from `buildSlidesFromData()` — the same `SlideData[]` array that powers the preview — ensuring 1:1 parity between what users see and what gets exported.

### Added
- **Auto-discovery engine** — `discoverRole()` scans each template slide's text shapes for `{{PLACEHOLDER}}` patterns and maps them to app slideKeys (title, challenge, solution, approach, investment, nextSteps, etc.).
- **Dual content-shape detection** — `getContentShapes()` identifies fillable text boxes using placeholder patterns (primary) or the two largest text shapes by area (fallback for templates with empty text boxes).
- **Slide duplication for unmatched app slides** — `duplicateAndFillRequests()` uses `duplicateObject` with pre-assigned IDs to clone a suitable template layout for app slides that lack a direct template counterpart (prob1/prob2/prob34 duplicate from challenge layout; ben1/ben2/ben34 from solution layout; additional slides from any content layout).
- **Text style preservation** — Captures `TextRunStyle` (font, size, color, bold) from each content shape before clearing, then reapplies after inserting new content.
- **Slide reordering** — `updateSlidesPosition` ensures final slide order matches the app's `SlideData[]` order.

### Fixed
- User edits (`editedProjectTitle`, `editedProblems`, `editedBenefits`, `customTitles`) now flow through to the exported deck (previously dropped by `buildReplaceRequests`).
- Additional slides added via chat now appear in the exported deck (previously dropped entirely).
- Conditional slides (approach, nextSteps, prob34, ben34) are correctly present or absent in the export, matching the preview.

---

## [2026-03-05] — Keep All Template Slides

### Changed
- **`googleSlidesTemplate.ts` — keep all 18 slides** — Removed `KEEP_INDICES_IN_ORDER`, `DELETE_INDICES`, and all slide deletion/reordering logic. The template is now copied as-is with all slides in their original order. Only static text cleanup and `{{PLACEHOLDER}}` replacement are applied. This means any slide arrangement should be done directly in the Google Slides template.

---

## [2026-03-05] — Static Text Cleanup in Template Builder

### Fixed
- **`googleSlidesTemplate.ts` overlap fix** — Added `buildStaticTextCleanupRequests()` that scans all slides for text elements containing "Lorem ipsum" or "Feedback Date" and deletes them before placeholder replacement. Prevents template sample text from overlapping real content in the output.

---

## [2026-03-05] — Always Route Through Template Builder

### Fixed
- **`GoogleSlidesButton.tsx` routing** — Removed `hasParamountMedia` conditional that routed Paramount proposals to the old dynamic builder (`createGoogleSlidesPresentation` from `googleSlides.ts`), which was not even imported. All presentations now always use `createTemplatePresentation` with template `1Hu53M6vbJRH4XaXJzyo6V30b8vxteN_sv2NO4FQfzHo`.

### Removed
- **`designConfig` prop from `GoogleSlidesButton`** — Only used by the old dynamic builder. Removed from props interface, component destructuring, and call sites in `App.tsx` and `DesignChatInterface.tsx`.

---

## [2026-03-05] — Template-Based Google Slides Builder via Drive API Copy

### Added
- **`googleSlidesTemplate.ts`** — `src/utils/googleSlidesTemplate.ts`; new slide builder that copies a master template presentation (`1Hu53M6vbJRH4XaXJzyo6V30b8vxteN_sv2NO4FQfzHo`) via the Drive API, then populates it with proposal content. Flow: (1) `POST /drive/v3/files/{id}/copy` to duplicate the template, (2) `GET /v1/presentations/{id}` to read all shape objectIds, (3) `POST /v1/presentations/{id}:batchUpdate` to delete 11 unwanted slides (indices 1,2,4,6,7,8,10,13,14,15,16) keeping 7 in order [0,5,3,11,12,9,17], (4) second batchUpdate to replace placeholder text in each shape (inheriting template typography), (5) third batchUpdate to insert client logo on the cover and next-steps closing slides (replacing "LOGO HERE" placeholder). Exports `createTemplatePresentation(data, accessToken): Promise<CreateSlidesResult>`.

### Changed
- **`GoogleSlidesButton.tsx` routing logic** — `src/components/GoogleSlidesButton.tsx`; added import for `createTemplatePresentation`; Paramount deck path (`paramountMedia` present) continues using the original `createGoogleSlidesPresentation` builder; all other decks now route to `createTemplatePresentation`; PROGRESS_STEPS[2] updated to "Copying template...", PROGRESS_STEPS[3] to "Populating slides..."
- **E2E tests updated for template path** — `e2e/app.spec.ts`; added Drive API mock (`**/drive.googleapis.com/**` → `{ id: 'fake-presentation-id' }`); Slides GET mock updated to return 18-slide array matching the template; Slides mocks split by HTTP method: GET → slides array, POST batchUpdate → `{}`, POST create → `{ presentationId }`

---

## [2026-03-05] — Refine Panel Layout, Paramount IP Expansion, autofit Fix

### Fixed
- **`autofitType` field name corrected** — `src/utils/googleSlides.ts`; Google Slides REST API expects `autofitType` (camelCase, lowercase `f`). Previous attempts of `autoFitType` (capital F) and `auto_fit_type` (snake_case) both returned 400. Entry added to `docs/ERRORS.md`.

### Changed
- **Refine step right panel decluttered** — `src/App.tsx`; removed brand color picker from the Refine sidebar entirely. `ChatInterface` wrapper changed from `overflow-hidden` to `overflow-y-auto` so the send button is no longer clipped. `GoogleSlidesButton` now sits directly below the chat with a thin border separator. Removed unused `derivePaletteFromHex` import.

### Added
- **The Masters Tournament added to Paramount IP inventory** — `src/utils/trainingContext.ts`; added to SPORTS section (CBS, April 10–13, 2026, 10M+ viewers, HHI $150K+) and Q2 2026 programming calendar.
- **Open IP Policy directive** — `src/utils/trainingContext.ts`; new section instructs the AI to accept and build with ANY user-specified Paramount/CBS property, show, event, or talent — never reject user-requested IP additions.
- **Iterate prompt accepts any IP** — `src/utils/llmService.ts`; `ITERATE_SYSTEM_PROMPT` updated to always generate slides when a user requests IP-specific slides, never refuse.

---

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-03-04] — Fix Google Slides autofit Read-Only Field Error

### Fixed
- **Removed all `autoFitRequest` calls** — `src/utils/googleSlides.ts`; Google Slides API now treats `autofit` as a read-only field. Any `updateShapeProperties` with `fields: 'autofit'` returns 400 "field mask includes read-only fields." Removed the function and all 20 call sites. Text boxes are already sized generously at creation time.

---

## [2026-03-04] — Fix Gemini 2.5 Flash Empty Response Failures

### Fixed
- **Disabled thinking tokens for structured-JSON calls** — `src/utils/llmService.ts`; added `thinkingConfig: { thinkingBudget: 0 }` to all 5 Gemini API call sites (`analyzeBriefPdf`, `extractBrandVoice`, `generateProposalContent`, `iterateProposalContent`, `iterateDesign`). Gemini 2.5 Flash's thinking mode intermittently consumed the output-token budget, producing empty responses that surfaced as "No content returned from Gemini" errors.
- **Added retry logic for empty LLM responses** — `src/utils/llmService.ts`; all JSON-generation calls now retry up to 2 times on empty responses before throwing, eliminating transient failures.
- **Increased `maxOutputTokens` for proposal generation** — `src/utils/llmService.ts`; bumped from 8192 → 16384 for `generateProposalContent` and 4096 → 8192 for `iterateProposalContent` to prevent truncated JSON on large proposals.

---

## [2026-03-04] — Refine Chatbot Visual Feedback Fix

### Fixed
- **Animation key now covers all bullet content** — `src/components/SlidePreview.tsx`; `chatUpdateVersion` prop forwarded from `SlidePreview` to `SlideCard` so the existing content-hash key (`bullets.join('|').slice(0, 60)`) plus timestamp actually triggers re-animation on chat updates
- **Chat updates now set a timestamp** — `src/App.tsx`; `lastChatUpdate` state added; `onExpansionsUpdated` callback wrapped to call `setLastChatUpdate(Date.now())` alongside `setExpansions`; value passed as `chatUpdateVersion` to `SlidePreview`

### Added
- **"Slides updated" flash banner** — `src/App.tsx`; emerald-colored `AnimatePresence` banner appears for 3 seconds after every chat-driven content update in the Refine step

---

## [2026-03-04] — Documenter Directive Update

### Changed
- **Documenter workflow now includes push step** — `CLAUDE.md`; step 5 added to Documenter Workflow requiring `git push origin main` after every commit; documentation that isn't pushed is treated as incomplete

---

## [2026-03-04] — Refine Tab UX + Paramount Media Sales Deck + Build Fixes

### Changed
- **Removed Slide Style picker from Refine tab** — `src/App.tsx`; the three-button Professional/Agency/Executive toggle is removed; `designStyle` always defaults to `'standard'`; brand color auto-detection from company name remains the primary theming mechanism
- **Prompt box enlarged** — `src/components/ChatInterface.tsx`; textarea `rows={2}` → `rows={3}`; messages scroll area now has a visible thin scrollbar (`scrollbarWidth: 'thin'`)
- **LLM generation upgraded to Paramount media sales output** — `src/utils/llmService.ts`; `SYSTEM_PROMPT` rewritten as a Paramount Advertising Solutions sales executive persona; returns full `paramountMedia` object alongside standard `problemExpansions`/`benefitExpansions`; schema includes IP alignments, integration concepts, talent opportunities, programming calendar, measurement framework, and 3-tier investment structure
- **`PARAMOUNT_TRAINING_CONTEXT` expanded** — `src/utils/trainingContext.ts`; richer Paramount asset inventory and brief-archetype playbook

### Added
- **`ParamountMediaContent` and related types** — `src/types/proposal.ts`; `IPAlignment`, `IntegrationConcept`, `CalendarItem`, `InvestmentTier`, `ParamountMediaContent` interfaces; `paramountMedia?: ParamountMediaContent` field on `ExpandedContent`
- **`'paramount'` color theme** — `src/types/proposal.ts`; added to `ColorTheme` union
- **Paramount-specific slide builders** — `src/utils/googleSlides.ts`; `opportunitySlide`, `ipAlignmentSlide`, `audienceSlide`, `integrationConceptSlide`, `talentSlide`, `programmingCalendarSlide`, `measurementSlide`, `tierInvestmentSlide`; full 13-slide Paramount media deck rendered when `paramountMedia` content is present

### Fixed
- **TypeScript build errors** — `src/utils/googleSlides.ts` (unused `data` param on `measurementSlide`), `src/utils/llmService.ts` (`ParamountMediaContent` cast via `unknown` intermediate)

---

## [2026-03-03] — Structured Brand Voice Profile + Custom Hex Color Picker

### Added
- **`BrandVoiceProfile` typed interface** — `src/types/proposal.ts`; replaces plain-string brand voice with a structured object: `tone: string[]`, `sentenceStyle`, `perspective`, `forbiddenPhrases: string[]`, `preferredVocabulary: string[]`, `ctaStyle`, `proseSummary`; gives the LLM explicit typed constraints instead of a prose guide to interpret
- **`customBrandHex?: string` on `DesignConfig`** — `src/types/proposal.ts`; user-supplied hex color (e.g. `"#FF6600"`) that takes priority over auto-detection and preset themes in the palette resolution chain
- **`derivePaletteFromHex(hex: string): SlidePalette`** — `src/utils/brandColors.ts`; public export of the internal `hexToPalette()` function; converts a single hex to a full 4-stop `SlidePalette` via HSL math; used by both the UI palette preview and the Google Slides renderer
- **`formatBrandVoiceConstraints(profile: BrandVoiceProfile): string`** — `src/utils/llmService.ts`; private helper that serializes a `BrandVoiceProfile` into a structured prompt block with labeled sections (Tone, Sentence style, Perspective, FORBIDDEN phrases, Preferred vocabulary, CTA style); replaces verbatim prose injection with typed, actionable constraints
- **Custom brand color picker** — `src/App.tsx`; native `<input type="color">` in the design panel; selecting a hex immediately renders a 4-swatch palette preview row computed via `derivePaletteFromHex()`; "Reset to auto" clears the override back to company auto-detection
- **Mini SVG slide thumbnails** on design style buttons — `src/App.tsx`; each of the three style buttons now includes an inline 40×25px SVG preview illustrating its key visual signature (white + thick bar, dark + watermark + split panel, near-black + hairlines); accent color in thumbnails tracks the active `customBrandHex`
- **Structured profile display in `BrandVoicePanel`** — `src/components/BrandVoicePanel.tsx`; when trained, the expanded panel shows: `proseSummary` in italic, tone chips (amber), and a two-column "Use / Avoid" vocabulary grid; tone chips also visible in collapsed header

### Changed
- **`BRAND_VOICE_PROMPT`** — `src/utils/llmService.ts`; changed from "return 200–400 word prose guide" to "return JSON with 7 typed fields"; added `responseMimeType: 'application/json'`; `extractBrandVoice()` return type changed from `Promise<string>` to `Promise<BrandVoiceProfile>` with JSON parse + safe defaults validation
- **`generateProposalContent()` brand voice parameter** — `src/utils/llmService.ts`; `brandVoice?: string` → `brandVoice?: BrandVoiceProfile`; injection now calls `formatBrandVoiceConstraints(profile)` instead of embedding prose directly
- **`iterateProposalContent()` brand voice parameter** — `src/utils/llmService.ts`; same change as above; structured constraints maintained across all refinement passes
- **`DESIGN_ITERATE_SYSTEM_PROMPT`** — `src/utils/llmService.ts`; added `"customBrandHex": "#RRGGBB" | null` to the response schema; added instruction to extract hex codes the user mentions; `iterateDesign()` now passes `customBrandHex` through in the returned `DesignConfig`
- **`BrandVoicePanel` props** — `src/components/BrandVoicePanel.tsx`; `brandVoice: string | null` → `BrandVoiceProfile | null`; `onBrandVoiceExtracted` callback updated accordingly; component stores profile as JSON in `localStorage` (was plain string)
- **`ChatInterface` props** — `src/components/ChatInterface.tsx`; `brandVoice?: string` → `BrandVoiceProfile | undefined`; forwarded to `iterateProposalContent()`
- **`brandVoice` state in `App.tsx`** — type changed from `string | null` to `BrandVoiceProfile | null`; `localStorage` initializer now JSON-parses with a backward-compat guard (old plain-string values silently cleared); `onBrandVoiceExtracted` callback checks `voice.tone.length > 0 || voice.proseSummary` before storing
- **Palette resolution in `createGoogleSlidesPresentation()`** — `src/utils/googleSlides.ts`; updated priority chain: 1) `designConfig.customBrandHex` via `derivePaletteFromHex()`, 2) auto-detect by company name via `getBrandPalette()`, 3) preset theme from `PALETTE_MAP`
- **Design style labels** — `src/App.tsx`; "Classic" → "Professional", "Bold" → "Agency" (Executive unchanged)

---

## [2026-03-03] — Approach & Next Steps Slides + Expanded Deck (up to 13 slides)

### Added
- **`approachSlide` (slide 7)** — `src/utils/googleSlides.ts`; numbered horizontal card layout ("OUR APPROACH / How We Deliver"); 3-4 delivery phases with accent-colored step numbers and a thin rule below each; theme-aware (dark bg for bold-agency/minimal); skipped entirely when `approachSteps` is empty
- **`benefitsCombined` (slide 10)** — `src/utils/googleSlides.ts`; two-column split layout for Benefits 3 & 4 (mirrors the `problemsCombined` pattern); skipped when both b3 and b4 are absent; respects `editedBenefits` overrides
- **`nextStepsSlide` (slide 12)** — `src/utils/googleSlides.ts`; two-column numbered layout ("WHAT HAPPENS NEXT / Next Steps"); up to 5 action items; theme-aware; skipped when `nextSteps` is empty
- **`approachSteps` and `nextSteps` on `ExpandedContent`** — `src/types/proposal.ts`; `approachSteps?: string[]` (3-4 methodology phases) and `nextSteps?: string[]` (4-5 post-agreement actions); both optional so existing proposals without them continue to render without these slides
- **`editedBenefits` on `ExpandedContent`** — `src/types/proposal.ts`; `editedBenefits?: [string, string, string, string]`; stores user inline edits for benefit bullets, consumed by `benefitsCombined` and benefit deep-dive slides
- **`approachSteps` and `nextSteps` in LLM generation** — `src/utils/llmService.ts`; `LLMResponse` interface extended with both fields; `SYSTEM_PROMPT` updated with content quality guidelines (problem expansions open with a specific business consequence; benefit expansions lead with a concrete measurable outcome); `generateProposalContent` returns all 4 content arrays
- **`approachSteps` and `nextSteps` in LLM iteration** — `src/utils/llmService.ts`; `ITERATE_SYSTEM_PROMPT` updated with schema for both new fields and instructions to update them only when the user's request relates to methodology/process/next steps; `iterateProposalContent` context prompt now includes current approach and next steps; merge logic uses `??` so LLM-returned updates win while `null` falls back to current values

### Changed
- **Deck expanded from 10 to up to 13 slides** — `src/utils/googleSlides.ts`; new slide order: Cover → Challenge → Prob1 → Prob2 → Prob3&4 → Solution → **Approach** → Ben1 → Ben2 → **Ben3&4** → Investment → **NextSteps** → Close; Approach and NextSteps are conditional (skipped when empty); deck always has at least 10 slides
- **`investmentSlide` visual redesign** — `src/utils/googleSlides.ts`; month breakdown replaced with a row of colored card rectangles (primary bg, accent labels, white values) instead of plain text lines; cards only rendered when month values are present
- **Logo URL upgraded** — `src/utils/googleSlides.ts`; switched from `s2/favicons?sz=128` to `faviconV2?size=256` (Google's newer endpoint); doubles resolution at the same zero-auth cost; removes 302 redirect risk
- **`logoRequests` now uses dynamic slide IDs** — `src/utils/googleSlides.ts`; cover and closing slide IDs resolved from `orderedSlides[0]` and `orderedSlides[last]` instead of hardcoded `slideIds[0]` / `slideIds[9]`; correct regardless of which optional slides are present
- **UI copy updated** — `src/App.tsx`, `src/components/GoogleSlidesButton.tsx`; "10-slide deck" references updated to "Up to 13 slides" and "professional presentation" to reflect variable deck size
- **E2E tests updated** — `e2e/app.spec.ts`; "Creates a 10-slide presentation" assertion updated to match new copy

---

## [2026-03-03] — Slide Design Overhaul & Extended Inline Editing

### Added
- **Brand Color Intelligence** — `src/utils/brandColors.ts` (new); auto-detects client brand palette from `data.client.company` at export time; ~50 major brands mapped (Nike, Starbucks, Google, Salesforce, McKinsey, etc.); derives full `SlidePalette` via HSL math; falls back to manual `colorTheme` for unknown brands
- **Bold Agency layout style** (`designStyle: 'bold-agency'`) — `src/utils/googleSlides.ts`; problem deep-dive slides go dark with large watermark numbers ("01"/"02"); solution slide becomes a left-accent / right-primary split panel; closing slide adds corner ellipses and a 44pt CTA with client company sub-line
- **Executive Minimal layout style** (`designStyle: 'executive-minimal'`) + **`executive-dark` palette** — all 10 slides use dark backgrounds; thick bars replaced with 4k EMU hairline rules; decorative ellipses removed; near-black primary with warm platinum accent
- **Slide Style picker** — `src/App.tsx`; three-button toggle (Classic / Bold / Executive) above the Google Slides export button in the Refine step; updates `designConfig.designStyle` in state
- **`DesignStyle` type** and extended `DesignConfig` — `src/types/proposal.ts`; `designStyle?: 'standard' | 'bold-agency' | 'executive-minimal'`; `disableBrandDetection?: boolean` to opt out of auto brand detection
- **Slide 1 (Cover) title editing** — `src/components/SlidePreview.tsx`, `src/App.tsx`, `src/utils/slideBuilder.ts`, `src/utils/googleSlides.ts`; clicking the project title on slide 1 opens an inline input; saves to `expansions.editedProjectTitle`; applied to both the preview and the exported Google Slides deck
- **Slide 2 (Challenge) bullet editing** — same files; clicking any problem bullet on slide 2 opens an inline textarea; saves to `expansions.editedProblems`; overrides parsed problems in both the preview and the exported deck
- **`editedProjectTitle` and `editedProblems` fields on `ExpandedContent`** — `src/types/proposal.ts`; optional overrides storing user edits for slides 1 and 2

### Changed
- **`EDITABLE_SLIDES` set expanded** — `src/components/SlidePreview.tsx`; was `[3, 4, 7, 8]`; now `[1, 2, 3, 4, 7, 8]`
- **Slide 1 title edit gating** — `src/components/SlidePreview.tsx`; removed `!isTitle` guard from the title edit condition so cover slides can have their title edited inline
- **Design chatbot system prompt updated** — `src/utils/llmService.ts`; now aware of `executive-dark` theme and all three `designStyle` values; returns `designStyle` in JSON response when user implies a layout change
- **`setDesignConfig` setter exposed** — `src/App.tsx`; `designConfig` state now has setter used by the style picker
- **`googleAuth.ts` token persistence** — `src/utils/googleAuth.ts`; access token now saved to `localStorage` (`gis_access_token` + `gis_token_expires_at`) on successful sign-in and restored on module load; users stay signed in across page refreshes for the ~1-hour token lifetime without re-prompting; `revokeToken()` clears both localStorage keys on sign-out

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
