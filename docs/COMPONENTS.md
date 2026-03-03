# Component Documentation

Auto-generated documentation for all React components in the Paramount application.

---

## Component Index

| Component | Location | Purpose |
|-----------|----------|---------|
| App | `src/App.tsx` | 3-step flow orchestrator: Draft → Refine → Export |
| Header | `src/components/Header.tsx` | Application header with logo, auth badge, and New button |
| BriefEditor | `src/components/BriefEditor.tsx` | Free-form brief text input (Step 1 paste mode) |
| BrandVoicePanel | `src/components/BrandVoicePanel.tsx` | Step 1 right panel — upload reference proposals to extract Paramount brand voice; persists to localStorage |
| PdfUploader | `src/components/PdfUploader.tsx` | PDF drag-drop upload; calls `analyzeBriefPdf()` for Gemini extraction |
| ChatInterface | `src/components/ChatInterface.tsx` | Step 2 Refine Content panel — multi-turn Gemini conversation for refining proposal content and adding slides |
| SlidePreview | `src/components/SlidePreview.tsx` | Step 2 preview — renders slide cards from real `ProposalData` (10 base + any additional); inline title editing on slides 1–4, 7–8, 11+; inline bullet editing on slides 2–4, 7–8, 11+ |
| GoogleSlidesButton | `src/components/GoogleSlidesButton.tsx` | Export — auth → LLM → Google Slides; accepts `preGeneratedContent`, `designConfig`, `onSuccess` |
| ProgressStepper | `src/components/ProgressStepper.tsx` | 3-step stepper (Draft/Refine/Export); only backward navigation to completed steps |
| ErrorBoundary | `src/components/ErrorBoundary.tsx` | React error boundary with fallback UI |
| DevTools | `src/components/DevTools.tsx` | Floating dev panel for error viewing (dev only) |

---

## Component Details

### App.tsx
**Purpose:** Main application component that orchestrates the 3-step proposal workflow.

**State Management:** Uses inline `useState` hooks for all state (brief text, expansions, design config, loading, errors, Google auth).

**Workflow Steps:**
1. Draft (brief input via paste or PDF upload) → 2. Refine (AI content chat, sticky sidebar, slide preview with inline editing, export) → 3. Export (success screen with Google Slides link and mailto)

**Refine Step Sidebar:** Sticky panel (`lg:sticky lg:top-[8.5rem]`) containing "Refine Content" label, `ChatInterface`, a **Slide Style picker** (Classic / Bold / Executive), and `GoogleSlidesButton`. Does not scroll with the slide preview.

**Slide Style Picker:** Three-button toggle above the export button; updates `designConfig.designStyle` in state. Options: `standard` (classic), `bold-agency` (dramatic dark layouts), `executive-minimal` (hairline rules, all-dark).

---

### BrandVoicePanel.tsx
**Purpose:** Step 1 right panel component — lets users upload example Paramount proposals so the app learns their writing style and strategic approach before generating any content.

**Props:**
- `brandVoice: string | null` — Current extracted brand voice guide (from `localStorage`); null if not yet trained
- `onBrandVoiceExtracted: (voice: string, fileCount: number) => void` — Callback fired on successful extraction or clear

**Features:**
- Collapsible — header always shows status badge ("Trained on X docs" / "Not configured"); body expands/collapses
- Multi-file drag-and-drop or click-to-browse (PDF only); files staged before training starts
- 3-stage loading animation matching `PdfUploader` visual style
- On success: shows a 1-sentence preview of the extracted voice guide; collapses automatically
- "Clear training" link removes localStorage entries; "Retrain" replaces existing training
- Calls `extractBrandVoice(files)` from `llmService.ts`
- Persists result in `localStorage` keys: `rfp_brand_voice` (text) + `rfp_brand_voice_count` (number)

**LLM function used:** `extractBrandVoice(files: File[])` → `string` (plain prose brand voice guide)

---

### ChatInterface.tsx
**Purpose:** Step 2 AI chat interface for multi-turn content iteration on the generated proposal.

**Props:**
- `briefText: string` — Raw brief text passed to Gemini as context
- `parsedData: Partial<ProposalData> | null` — Structured brief data for richer context
- `onExpansionsUpdated` — Callback fired when Gemini returns updated `problemExpansions` and/or `benefitExpansions`; `App.tsx` stores these for passing to `GoogleSlidesButton` as `preGeneratedContent`
- `brandVoice?: string` — Optional brand voice guide; forwarded to `iterateProposalContent()` to ensure refinements maintain Paramount's writing style

**Features:**
- Multi-turn conversation history preserved across messages
- Suggested prompt chips for common requests (tone changes, language adjustments, focus shifts)
- Calls `iterateProposalContent()` from `llmService.ts`
- Displays Gemini reply text; silently updates expansions in the background via callback

**LLM function used:** `iterateProposalContent(brief, parsedData, currentExpansions, instruction, history, brandVoice?)` → `{reply, updatedExpansions?}`

---

### GoogleSlidesButton.tsx
**Purpose:** Direct Google Slides API integration — creates a presentation (10–13 slides) in the user's Google Drive and provides a link to open/edit it.

**Props:**
- `data: Partial<ProposalData> | null` — Parsed brief data
- `briefText: string` — Raw brief text (passed to LLM for content generation)
- `isEmpty: boolean` — Disables button when no brief is entered
- `preGeneratedContent` — Pre-generated expansions from `ChatInterface`; skips the LLM call inside this component when already iterated in Step 2
- `designConfig` — Color theme configuration (navy-gold, slate-blue, forest-green) from `DesignChatInterface`
- `onSuccess` — Callback fired after successful slide creation; used by `App.tsx` to advance to the Export step

**State machine:** `idle → authenticating → generating → creating → done | error`

**Flow:**
1. User clicks button → `getValidToken()` triggers Google OAuth popup
2. LLM generates personalized problem/benefit expansions via Gemini (skipped if `preGeneratedContent` provided)
3. `createGoogleSlidesPresentation()` creates presentation via Google Slides REST API
4. "Open in Google Slides" link appears; `onSuccess` callback fires to advance to Export step

**Slide structure (up to 13):** Title, Challenge, Prob Deep Dive ×2, Prob3&4 Combined, Solution, **Approach** (optional), Ben Deep Dive ×2, **Ben3&4 Combined**, Investment, **Next Steps** (optional), Closing CTA. Approach and Next Steps slides are skipped when the LLM returns empty arrays for those fields.

**Utilities used:**
- `src/utils/googleAuth.ts` — OAuth token management
- `src/utils/googleSlides.ts` — Slides API calls
- `src/utils/llmService.ts` — Gemini content generation
- `src/utils/errorHandler.ts` — `logError`

---

### SlidePreview.tsx
**Purpose:** Renders slide cards (10+ when approach/next steps are present) from live `ProposalData` in Step 2; applies the active color theme to the HTML preview.

**Props:**
- `fileName?: string` — Presentation title shown in header
- `data?: Partial<ProposalData> | null` — Proposal content; shows an empty state when null
- `designConfig?: DesignConfig` — Active color theme; resolved to `ThemeTokens` via `THEME_MAP`
- `isUpdating?: boolean` — Shows a shimmer overlay while Gemini is rewriting content
- `onSlideEdit?: (slideNumber: number, bulletIndex: number, newText: string) => void` — Inline edit callback; only `EDITABLE_SLIDES = Set([3, 4, 7, 8])` fire this

**Theme system:** `ThemeTokens` interface maps 6 Tailwind slot names (`accentBar`, `badgeBg`, `badgeText`, `title`, `subtitle`, `bullet`) to class strings. `THEME_MAP` provides token objects for all three `ColorTheme` values (navy-gold, slate-blue, forest-green). Defaults to navy-gold when no `designConfig` is provided.

**Slide data:** Calls `buildSlidesFromData()` from `src/utils/slideBuilder.ts` to convert `ProposalData` into 10 `SlideData` cards; uses `'—'` as placeholder for missing fields.

---

### DesignChatInterface.tsx
**Purpose:** Step 2 Design tab — Gemini-powered chatbot for selecting and previewing color themes; includes a direct export button.

**Props:**
- `currentDesignConfig: DesignConfig` — Active theme passed in from `App.tsx`
- `onDesignConfigUpdated: (config: DesignConfig) => void` — Fires when Gemini classifies user input as a theme change; App updates `designConfig` state which propagates to `SlidePreview` and `GoogleSlidesButton`
- `parsedData: Partial<ProposalData> | null` — Proposal data forwarded to `GoogleSlidesButton`
- `briefText: string` — Raw brief forwarded to `GoogleSlidesButton`
- `expansions` — Pre-generated LLM expansions forwarded to `GoogleSlidesButton`
- `onSlidesSuccess: (url: string) => void` — Fired when export succeeds; advances to Export step

**Features:**
- 6 suggested prompts for theme requests
- Current theme badge shows active selection (Navy & Gold / Slate & Blue / Forest Green)
- Calls `iterateDesign()` from `llmService.ts`; extracts `designConfig` from JSON response when present
- Embeds `GoogleSlidesButton` at bottom for one-click export with active theme applied

---

### googleAuth.ts
**Location:** `src/utils/googleAuth.ts`

**Purpose:** Manages Google OAuth 2.0 access tokens via Google Identity Services (GIS) implicit flow.

**Exports:**
- `getValidToken(): Promise<string>` — Returns cached token or triggers new sign-in
- `requestGoogleToken(): Promise<string>` — Forces fresh OAuth popup
- `getAuthState(): GoogleAuthState` — Current token state
- `revokeToken(): void` — Clears cached token and revokes with Google

**Notes:** Token persisted to `localStorage` (`gis_access_token` + `gis_token_expires_at`) on sign-in and restored on page load. Survives refreshes for the ~1-hour token lifetime. GIS `prompt: ''` attempts silent re-auth after expiry. No backend required.

---

### googleSlides.ts
**Location:** `src/utils/googleSlides.ts`

**Purpose:** Creates Google Slides presentations via REST API using a three-phase approach with Paramount branding.

**Exports:**
- `createGoogleSlidesPresentation(data: ProposalData, accessToken: string, designConfig?: DesignConfig): Promise<CreateSlidesResult>`

**Phase 1:** `POST /v1/presentations` — create empty presentation
**Phase 2:** `POST /v1/presentations/{id}:batchUpdate` — build all slides (10–13) in one atomic request; `orderedSlides` array filters out optional slides (`approachSlide`, `benefitsCombined`, `nextStepsSlide`) when their data arrays are empty
**Phase 3:** `POST /v1/presentations/{id}:batchUpdate` — insert logos (best-effort, failures silently caught); cover/close IDs resolved dynamically from `orderedSlides` so they're correct regardless of which optional slides are present

**Brand:** Montserrat headings, Inter body text. Brand colors are driven by `designConfig`. Logos auto-fetched via Google Favicon API (`google.com/s2/favicons?sz=128`).

**Palette system:** `SlidePalette` interface defines four `RgbColor` slots — `primary`, `primaryLighter`, `primaryDarker`, `accent`. `PALETTE_MAP: Record<ColorTheme, SlidePalette>` maps each theme to concrete RGB values:
- `navy-gold` — primary `#0D1F40`, accent `#F27321` (Paramount brand defaults)
- `slate-blue` — primary `#1E3A5F`, accent `#3B82F5`
- `forest-green` — primary `#1A3A2A`, accent `#22C55E`

All slide-builder functions accept `palette: SlidePalette` and `opts: SlideOpts` as their last parameters. `createGoogleSlidesPresentation` resolves the palette from `designConfig` (defaults to `'navy-gold'`) and passes it through to every builder.

**Slide builders:** `titleSlide`, `challengeSlide`, `problemDeepDive`, `problemsCombined`, `solutionSlide`, `approachSlide`, `benefitsCombined`, `nextStepsSlide`, `investmentSlide`, `closingSlide`

**Logo URL:** `faviconV2?size=256` (Google's higher-res endpoint, no redirects)

**Cover slide layout:** Split-panel design — left 65% content zone, right 35% branded panel (`primaryLighter`). Panel contains client label, client logo, orange divider rule, "PARAMOUNT" label, and Paramount logo — all vertically centered. Labels/divider drawn in Phase 2; logo images inserted in Phase 3 using shared layout constants (`LOGO_X`, `COVER_CLOGO_Y`, `COVER_PLOGO_Y`).

**Closing slide layout:** `primary` background, two thin `accent`-colored horizontal rules bracket the CTA text, Paramount logo centered above the rules (Phase 3).

**Returns:** `{ presentationId, presentationUrl, title }`

---

### Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| useBriefParser | `src/hooks/useBriefParser.ts` | Parses free-form text into structured ProposalData |

---

### Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| slideBuilder | `src/utils/slideBuilder.ts` | `buildSlidesFromData()` — converts `ProposalData` into `SlideData` cards for preview (10+ when approach/next steps present) |
| contentExpander | `src/utils/contentExpander.ts` | Template-based content expansion for problems and benefits |
| validators | `src/utils/validators.ts` | Input validation functions |
| errorHandler | `src/utils/errorHandler.ts` | Centralized error logging and debugging utilities |
| llmService | `src/utils/llmService.ts` | Gemini 2.5 Flash: `analyzeBriefPdf()`, `generateProposalContent()` (returns 4 content arrays incl. `approachSteps`/`nextSteps`), `iterateProposalContent()` (preserves/updates all 4 arrays), `iterateDesign()`, `extractBrandVoice()` |
| googleAuth | `src/utils/googleAuth.ts` | Google OAuth 2.0 token management via GIS |
| googleSlides | `src/utils/googleSlides.ts` | Google Slides REST API — 3-phase presentation creation with theme-aware palette system |

---

---

### llmService.ts (updated)
**Location:** `src/utils/llmService.ts`

**PDF size routing in `analyzeBriefPdf()`:**
- `> 50 MB` → throws immediately (`MAX_PDF_SIZE` exported for `PdfUploader`)
- `> 15 MB` → `uploadToFilesApi()` → `file_data: { mime_type, file_uri }` part; file deleted after extraction
- `≤ 15 MB` → `fileToBase64()` → `inline_data: { mime_type, data }` part (original path)

**Retry logic:** If `JSON.parse` fails (e.g. truncated output), retries once without `responseMimeType` + strips markdown fences via `extractJsonFromText()`.

**New helpers:** `uploadToFilesApi(file, apiKey)`, `deleteFilesApiFile(fileUri, apiKey)`, `extractJsonFromText(text)`, `buildBriefText(extracted)`

**New constants:** `FILES_API_UPLOAD`, `FILES_API_BASE`, `LARGE_PDF_THRESHOLD` (15 MB), `MAX_PDF_SIZE` (50 MB, exported)

**New export:** `extractBrandVoice(files, apiKey)` — brand voice extraction from reference files; uses same Files API routing threshold

---

## Last Updated
- Date: 2026-03-03
- Changes: Added `approachSlide`, `benefitsCombined`, `nextStepsSlide` builders; updated deck from 10 to 13 slides; updated llmService to generate/iterate `approachSteps` and `nextSteps`; logo URL upgraded to faviconV2
