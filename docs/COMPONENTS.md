# Component Documentation

Auto-generated documentation for all React components in the Paramount application.

---

## Component Index

| Component | Location | Purpose |
|-----------|----------|---------|
| App | `src/App.tsx` | 3-step flow orchestrator: Draft → Refine → Export |
| Header | `src/components/Header.tsx` | Application header with logo, "Paramount Proj" app name label, auth badge, and New button |
| BriefEditor | `src/components/BriefEditor.tsx` | Free-form brief text input (Step 1 paste mode) |
| BrandVoicePanel | `src/components/BrandVoicePanel.tsx` | Step 1 right panel — upload reference proposals to extract Paramount brand voice; persists to localStorage |
| PdfUploader | `src/components/PdfUploader.tsx` | PDF drag-drop upload; calls `analyzeBriefPdf()` for Gemini extraction |
| ChatInterface | `src/components/ChatInterface.tsx` | Step 2 Refine Content panel — multi-turn Gemini conversation for refining proposal content and adding slides |
| SlidePreview | `src/components/SlidePreview.tsx` | Step 2 preview — renders slide cards from real `ProposalData` (11 base persuasion arc + any additional); inline title/bullet editing on editable slides |
| GoogleSlidesButton | `src/components/GoogleSlidesButton.tsx` | Export — auth → LLM → template copy → populate; accepts `preGeneratedContent`, `onSuccess` |
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

**Refine Step Sidebar:** Sticky panel (`lg:sticky lg:top-[8.5rem]`) containing "Refine Content" label, `ChatInterface` (flex-1, overflow-y-auto wrapper), and `GoogleSlidesButton` pinned at the bottom. Brand color picker was removed from this panel. Does not scroll with the slide preview.

**Brand Color / Design Config:** `designConfig.customBrandHex` is still respected by `googleSlides.ts` (palette priority: custom hex → company auto-detect → preset theme), but the hex input UI was removed from the Refine sidebar to reduce crowding.

---

### BrandVoicePanel.tsx
**Purpose:** Step 1 right panel component — lets users upload example Paramount proposals so the app learns their writing style and strategic approach before generating any content.

**Props:**
- `brandVoice: BrandVoiceProfile | null` — Structured brand voice profile (from `localStorage`); null if not yet trained
- `onBrandVoiceExtracted: (voice: BrandVoiceProfile, fileCount: number) => void` — Callback fired on successful extraction or clear

**Features:**
- Collapsible — header always shows "Trained on X docs" badge + up to 2 tone chips when trained
- Multi-file drag-and-drop or click-to-browse (PDF only); files staged before training starts
- 3-stage loading animation (Reading → Analysing → Building profile)
- On success: collapses automatically and displays structured profile: `proseSummary` in italic, tone chips (amber), two-column "Use / Avoid" vocabulary grid (up to 5 items each)
- "Clear training" link removes localStorage entries; "Retrain" replaces existing training
- Calls `extractBrandVoice(files)` from `llmService.ts`
- Persists result in `localStorage` keys: `rfp_brand_voice` (JSON string of `BrandVoiceProfile`) + `rfp_brand_voice_count`

**LLM function used:** `extractBrandVoice(files: File[])` → `BrandVoiceProfile` (structured JSON, 7 typed fields)

---

### ChatInterface.tsx
**Purpose:** Step 2 AI chat interface for multi-turn content iteration on the generated proposal.

**Props:**
- `briefText: string` — Raw brief text passed to Gemini as context
- `parsedData: Partial<ProposalData> | null` — Structured brief data for richer context
- `onExpansionsUpdated` — Callback fired when Gemini returns updated `problemExpansions` and/or `benefitExpansions`; `App.tsx` stores these for passing to `GoogleSlidesButton` as `preGeneratedContent`
- `brandVoice?: BrandVoiceProfile` — Optional structured brand voice profile; forwarded to `iterateProposalContent()` as typed constraints ensuring refinements maintain the client's writing style

**Features:**
- Multi-turn conversation history preserved across messages
- Suggested prompt chips for common requests (tone changes, language adjustments, focus shifts)
- Calls `iterateProposalContent()` from `llmService.ts`
- Displays Gemini reply text; silently updates expansions in the background via callback
- **Textarea** `rows={3}` with visible thin scrollbar on the messages area

**LLM function used:** `iterateProposalContent(brief, parsedData, currentExpansions, instruction, history, brandVoice?: BrandVoiceProfile)` → `{reply, updatedExpansions?}`

---

### GoogleSlidesButton.tsx
**Purpose:** Direct Google Slides API integration — creates a presentation (11-slide persuasion arc + optional extras) in the user's Google Drive and provides a link to open/edit it.

**Props:**
- `data: Partial<ProposalData> | null` — Parsed brief data
- `briefText: string` — Raw brief text (passed to LLM for content generation)
- `isEmpty: boolean` — Disables button when no brief is entered
- `preGeneratedContent` — Pre-generated expansions from `ChatInterface`; skips the LLM call inside this component when already iterated in Step 2
- `onSuccess` — Callback fired after successful slide creation; used by `App.tsx` to advance to the Export step
- `designConfig?: DesignConfig` — Color theme and design style for the presentation
- `brandVoice?: BrandVoiceProfile | null` — Structured brand voice profile; passed to `generateProposalContent()` when `preGeneratedContent` is null

**State machine:** `idle → authenticating → generating → creating → done | error`

**Flow:**
1. User clicks button → `ensureFreshToken()` guarantees token has ≥2 min remaining
2. LLM generates personalized content via Gemini with `brandVoice` (skipped if `preGeneratedContent` provided)
3. `ensureFreshToken()` called AGAIN before Slides creation to prevent mid-flow expiry
4. Slides builders receive a `getToken` callback (not a static token) so they can refresh on 401
5. "Open in Google Slides" link appears; `onSuccess` callback fires to advance to Export step

**Error handling:** Typed error detection for `FetchTimeoutError` (timeout message), `FetchRetryExhaustedError` (429 → "busy", 5xx → "unavailable"), `GeminiBlockedError` (safety → "flagged content"), and sentinel prefixes (`AUTH_EXPIRED`, `RATE_LIMITED`, `FORBIDDEN`).

**Utilities used:**
- `src/utils/googleAuth.ts` — `ensureFreshToken()` for OAuth token management
- `src/utils/googleSlides.ts` — Paramount deck creation (accepts `TokenGetter` callback)
- `src/utils/googleSlidesTemplate.ts` — Template-copy deck creation (accepts `TokenGetter` callback)
- `src/utils/llmService.ts` — Gemini content generation
- `src/utils/fetchWithRetry.ts` — Error types for typed catch blocks
- `src/utils/errorHandler.ts` — `logError`

---

### SlidePreview.tsx
**Purpose:** Renders slide cards (11 base persuasion arc + optional next steps + any additional) from live `ProposalData` in Step 2; applies the active color theme to the HTML preview.

**Props:**
- `fileName?: string` — Presentation title shown in header
- `data?: Partial<ProposalData> | null` — Proposal content; shows an empty state when null
- `designConfig?: DesignConfig` — Active color theme; resolved to `ThemeTokens` via `THEME_MAP`
- `isUpdating?: boolean` — Shows a shimmer overlay while Gemini is rewriting content
- `onSlideEdit?: (slideNumber: number, bulletIndex: number, newText: string) => void` — Inline edit callback for editable slides
- `onSlideTitleEdit?: (slideNumber: number, newTitle: string) => void` — Inline title edit callback

**Theme system:** `ThemeTokens` interface maps 6 Tailwind slot names (`accentBar`, `badgeBg`, `badgeText`, `title`, `subtitle`, `bullet`) to class strings. `THEME_MAP` provides token objects for all `ColorTheme` values. Defaults to navy-gold when no `designConfig` is provided.

**Slide data:** Calls `buildSlidesFromData()` from `src/utils/slideBuilder.ts` to convert `ProposalData` into the 11-slide persuasion arc: Cover → Cultural Shift → Real Problem → Cost of Inaction → Core Insight → Paramount Advantage → Proof → How It Works → Custom Plan → ROI Framing → Close (+ optional Next Steps, additional slides).

**`hasRealData` guard:** `true` when any of `client.company`, `project.title`, `content.problems[0]`, or `data.expanded` is present. The `data.expanded` check is critical for short-prompt flows where `parsedData` is null but AI-generated `ExpandedContent` is set.

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
- Embeds `GoogleSlidesButton` at bottom for one-click export

---

### googleAuth.ts
**Location:** `src/utils/googleAuth.ts`

**Purpose:** Manages Google OAuth 2.0 access tokens via Google Identity Services (GIS) implicit flow.

**Exports:**
- `getValidToken(): Promise<string>` — Returns cached token or triggers new sign-in
- `ensureFreshToken(bufferMs?: number): Promise<string>` — Returns cached token only if it has ≥`bufferMs` (default 120s) remaining; otherwise triggers re-auth. Use before multi-step flows.
- `requestGoogleToken(): Promise<string>` — Forces fresh OAuth popup
- `getAuthState(): GoogleAuthState` — Current token state
- `clearExpiredToken(): void` — Clears in-memory + localStorage token if expired (used by visibilitychange handler)
- `revokeToken(): void` — Clears cached token and revokes with Google

**Notes:** Token persisted to `localStorage` (`gis_access_token` + `gis_token_expires_at`) on sign-in and restored on page load. Survives refreshes for the ~1-hour token lifetime. After first consent, `prompt: ''` is used for faster/silent re-auth (tracked via `gis_has_consented` localStorage key). `App.tsx` has a `visibilitychange` handler that calls `clearExpiredToken()` when the user returns to the tab after idle.

---

### googleSlides.ts
**Location:** `src/utils/googleSlides.ts`

**Purpose:** Creates Google Slides presentations via REST API using a three-phase approach with Paramount branding.

**Exports:**
- `createGoogleSlidesPresentation(data: ProposalData, getToken: TokenGetter, designConfig?: DesignConfig): Promise<CreateSlidesResult>` — Accepts a `TokenGetter` callback (not a static token) so tokens can be refreshed mid-flow on 401 errors.
- `TokenGetter` — Type alias: `() => Promise<string>`
- `CreateSlidesResult` — Interface: `{ presentationId, presentationUrl, title }`

**Phase 1:** `POST /v1/presentations` — create empty presentation (wrapped in `withBackoff` with token refresh on 401)
**Phase 2:** `POST /v1/presentations/{id}:batchUpdate` — build all slides (11-slide persuasion arc + optional) in one atomic request; `orderedSlides` array filters out optional slides; wrapped in `withBackoff` with 401 retry
**Phase 3:** `POST /v1/presentations/{id}:batchUpdate` — insert logos (best-effort, failures silently caught); uses fresh token from `getToken()`

**Brand:** Montserrat headings, Inter body text. Brand colors are driven by `designConfig`. Logos auto-fetched via Google Favicon API (`google.com/s2/favicons?sz=128`).

**Palette system:** `SlidePalette` interface defines four `RgbColor` slots — `primary`, `primaryLighter`, `primaryDarker`, `accent`. `PALETTE_MAP: Record<ColorTheme, SlidePalette>` maps each theme to concrete RGB values:
- `navy-gold` — primary `#0D1F40`, accent `#F27321` (Paramount brand defaults)
- `slate-blue` — primary `#1E3A5F`, accent `#3B82F5`
- `forest-green` — primary `#1A3A2A`, accent `#22C55E`

All slide-builder functions accept `palette: SlidePalette` and `opts: SlideOpts` as their last parameters. `createGoogleSlidesPresentation` resolves the palette using a **priority chain**:
1. `designConfig.customBrandHex` → `derivePaletteFromHex(hex)` (user-supplied color, highest priority)
2. Company name auto-detection → `getBrandPalette(data.client.company)` (skipped if `disableBrandDetection`)
3. Preset theme → `PALETTE_MAP[colorTheme]` (fallback)

**Slide builders (persuasion arc):** `titleSlide`, `culturalShiftSlide`, `realProblemSlide`, `costSlide`, `coreInsightSlide`, `paramountAdvantageSlide`, `proofSlide`, `howItWorksSlide`, `customPlanSlide`, `roiFramingSlide`, `nextStepsSlide`, `closingSlide`

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
| fetchWithRetry | `src/utils/fetchWithRetry.ts` | Drop-in `fetch()` replacement with exponential backoff, configurable timeout via `AbortController`, auto-retry on 429/500/502/503. Exports `FetchTimeoutError` and `FetchRetryExhaustedError` for typed catch blocks. |
| slideBuilder | `src/utils/slideBuilder.ts` | `buildSlidesFromData()` — converts `ProposalData` into the 11-slide persuasion arc `SlideData` cards for preview (+ optional next steps and additional slides) |
| contentExpander | `src/utils/contentExpander.ts` | Template-based content expansion for problems and benefits |
| validators | `src/utils/validators.ts` | Input validation functions |
| errorHandler | `src/utils/errorHandler.ts` | Centralized error logging and debugging utilities |
| llmService | `src/utils/llmService.ts` | Gemini 3 Flash: `analyzeBriefPdf()`, `generateProposalContent()`, `iterateProposalContent()`, `iterateDesign()`, `extractBrandVoice()`. SYSTEM_PROMPT generates the 11-slide persuasion arc with dynamic client personalization, automated proof insertion (PROOF_POINTS_DATABASE), and industry-specific insights (INDUSTRY_INSIGHTS_MAP). All calls use `fetchWithRetry` + `validateGeminiBody()`. Exports `GeminiBlockedError` for typed error handling. |
| googleAuth | `src/utils/googleAuth.ts` | Google OAuth 2.0 token management via GIS; `ensureFreshToken(bufferMs)` for long-running flows |
| googleSlides | `src/utils/googleSlides.ts` | Google Slides REST API — 3-phase presentation creation with theme-aware palette system; `withBackoff` retries on 429 + 401 |
| googleSlidesTemplate | `src/utils/googleSlidesTemplate.ts` | Template-based slide builder — copies template via Drive API, auto-discovers roles, clear-and-fill from SlideData[]; `withBackoff` retries on 429 + 401 |
| trainingContext | `src/utils/trainingContext.ts` | Pre-seeded training context for LLM: `PARAMOUNT_TRAINING_CONTEXT`, `PROOF_POINTS_DATABASE` (case study stats for automated proof insertion), `INDUSTRY_INSIGHTS_MAP` (category-specific trend insights for QSR, telecom, etc.) |
| brandColors | `src/utils/brandColors.ts` | Brand palette derivation: `getBrandPalette(company)` for ~50 known brands; `derivePaletteFromHex(hex)` derives a full 4-stop `SlidePalette` from any hex color |

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

### googleSlidesTemplate.ts
**Location:** `src/utils/googleSlidesTemplate.ts`

**Purpose:** Template-based Google Slides builder using a clear-and-fill approach. Copies a pre-designed master template via the Drive API, auto-discovers slide roles from `{{PLACEHOLDER}}` patterns, then clears text and injects content from the same `SlideData[]` array that powers the preview — ensuring 1:1 parity between what the user sees and what gets exported.

**Exports:**
- `createTemplatePresentation(data: ProposalData, getToken: TokenGetter): Promise<CreateSlidesResult>` — Accepts a `TokenGetter` callback for token refresh on 401. All phases (copy, read, batchUpdate, logos) use `withBackoff` with automatic token refresh.

**Template ID:** `1brp4caHLITlfqqFiYUs9fNLhC_1tgWDJBzKF-0QHLf8`

**7-phase build process:**
1. **Copy** — `POST /drive/v3/files/{templateId}/copy` duplicates the master template
2. **Read** — `GET /v1/presentations/{id}` fetches all slides and shape objectIds
3. **Build SlideData[]** — calls `buildSlidesFromData(data)` (same source as preview)
4. **Auto-discover** — `discoverRole()` scans template slides for placeholder patterns to identify roles
5. **Map** — each app slide is matched to a template slide (direct match) or a duplicate (cloned via `duplicateObject`)
6. **Clear + Fill** — `deleteText` + `insertText` + `updateTextStyle` on content shapes; unused slides deleted via `deleteObject`; final order set via `updateSlidesPosition`
7. **Logos** — re-reads presentation, inserts Paramount + client logos

**Key functions:**
- `discoverRole(slide)` — maps placeholder patterns to slideKeys
- `getContentShapes(slide)` — finds fillable text shapes (primary: `{{` detection; fallback: largest shapes by area); captures height/width for font sizing
- `fillSlideRequests(shapes, appSlide)` — clears and inserts title/subtitle/bullets; truncates text to fit shape dimensions; reduces font size when content exceeds box capacity (down to 8pt minimum)
- `duplicateAndFillRequests(source, shapes, appSlide, newId)` — clones a template slide and populates it
- `chooseFontSize(textLength, height, width, originalPt)` — estimates max characters for a shape and steps down font size until text fits
- `truncateToFit(text, maxChars)` — truncates at word boundary with ellipsis

**Returns:** `{ presentationId, presentationUrl, title }`

---

---

## Vercel Serverless Functions (API Layer)

The Express backend (`server/`) runs locally in dev. For production on Vercel, equivalent Serverless Functions live in `api/`.

| Function | Path | Methods | Purpose |
|----------|------|---------|---------|
| `api/gemini/generate-content.ts` | `/api/gemini/generate-content` | POST | Proxy Gemini generateContent (keeps API key server-side) |
| `api/gemini/upload-file.ts` | `/api/gemini/upload-file` | POST | Upload base64 PDF to Gemini Files API |
| `api/gemini/files/[fileId].ts` | `/api/gemini/files/:fileId` | DELETE | Delete file from Gemini Files API |
| `api/brand-voice/index.ts` | `/api/brand-voice` | GET, POST, DELETE | CRUD for brand voice profiles (PostgreSQL) |
| `api/proposals/index.ts` | `/api/proposals` | GET, POST | List/create proposals (PostgreSQL) |
| `api/proposals/[id].ts` | `/api/proposals/:id` | GET, PATCH, DELETE | Read/update/delete single proposal |
| `api/health.ts` | `/api/health` | GET | Health check |

**Shared modules (`api/_lib/`):**
- `db.ts` — Drizzle ORM + postgres.js connection with `globalThis` caching for serverless warm starts
- `schema.ts` — Database schema (mirrors `server/schema.ts`)
- `cors.ts` — CORS preflight handler for all functions

**Required Vercel Environment Variables:**
- `GEMINI_API_KEY` — Gemini API key (server-side only, not `VITE_` prefixed)
- `DATABASE_URL` — PostgreSQL connection string with SSL
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth Client ID (build-time, needs `VITE_` prefix)
- `FRONTEND_ORIGIN` — Production URL for CORS (defaults to Vercel app URL)

---

## Last Updated
- Date: 2026-03-18
- Changes: Short-prompt slide preview fix (hasRealData guard), app branding alignment (Paramount Proj), legal pages (privacy/terms), Google OAuth verification files
