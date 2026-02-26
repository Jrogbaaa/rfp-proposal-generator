# Component Documentation

Auto-generated documentation for all React components in the Paramount application.

---

## Component Index

| Component | Location | Purpose |
|-----------|----------|---------|
| App | `src/App.tsx` | 3-step flow orchestrator: Draft → Refine → Export |
| Header | `src/components/Header.tsx` | Application header with logo, auth badge, and New button |
| BriefEditor | `src/components/BriefEditor.tsx` | Free-form brief text input (Step 1 paste mode) |
| PdfUploader | `src/components/PdfUploader.tsx` | PDF drag-drop upload; calls `analyzeBriefPdf()` for Gemini extraction |
| ChatInterface | `src/components/ChatInterface.tsx` | Step 2 Content tab — multi-turn Gemini conversation for refining proposal content |
| DesignChatInterface | `src/components/DesignChatInterface.tsx` | Step 2 Design tab — Gemini-powered theme selection chat + export button |
| SlidePreview | `src/components/SlidePreview.tsx` | Step 2 preview — renders 10 slide cards from real `ProposalData`; shows empty state when no data |
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
1. Draft (brief input via paste or PDF upload) → 2. Refine (AI content + design chat, slide preview, export) → 3. Export (success screen with Google Slides link and mailto)

---

### ChatInterface.tsx
**Purpose:** Step 2 AI chat interface for multi-turn content iteration on the generated proposal.

**Props:**
- `briefText: string` — Raw brief text passed to Gemini as context
- `parsedData: Partial<ProposalData> | null` — Structured brief data for richer context
- `onExpansionsUpdated` — Callback fired when Gemini returns updated `problemExpansions` and/or `benefitExpansions`; `App.tsx` stores these for passing to `GoogleSlidesButton` as `preGeneratedContent`

**Features:**
- Multi-turn conversation history preserved across messages
- Suggested prompt chips for common requests (tone changes, language adjustments, focus shifts)
- Calls `iterateProposalContent()` from `llmService.ts`
- Displays Gemini reply text; silently updates expansions in the background via callback

**LLM function used:** `iterateProposalContent(brief, parsedData, currentExpansions, instruction, history)` → `{reply, updatedExpansions?}`

---

### GoogleSlidesButton.tsx
**Purpose:** Direct Google Slides API integration — creates a 10-slide presentation in the user's Google Drive and provides a link to open/edit it.

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

**10-slide structure:** Title, Challenge (problems list), Problem Deep Dives ×3, Solution (benefits list), Benefit Deep Dives ×2, Investment & Timeline, Closing CTA

**Utilities used:**
- `src/utils/googleAuth.ts` — OAuth token management
- `src/utils/googleSlides.ts` — Slides API calls
- `src/utils/llmService.ts` — Gemini content generation
- `src/utils/errorHandler.ts` — `logError`

---

### googleAuth.ts
**Location:** `src/utils/googleAuth.ts`

**Purpose:** Manages Google OAuth 2.0 access tokens via Google Identity Services (GIS) implicit flow.

**Exports:**
- `getValidToken(): Promise<string>` — Returns cached token or triggers new sign-in
- `requestGoogleToken(): Promise<string>` — Forces fresh OAuth popup
- `getAuthState(): GoogleAuthState` — Current token state
- `revokeToken(): void` — Clears cached token and revokes with Google

**Notes:** Token stored in-memory only. 1-hour expiry. No backend required.

---

### googleSlides.ts
**Location:** `src/utils/googleSlides.ts`

**Purpose:** Creates Google Slides presentations via REST API using a three-phase approach with Paramount branding.

**Exports:**
- `createGoogleSlidesPresentation(data: ProposalData, accessToken: string, designConfig?: DesignConfig): Promise<CreateSlidesResult>`

**Phase 1:** `POST /v1/presentations` — create empty presentation
**Phase 2:** `POST /v1/presentations/{id}:batchUpdate` — build all 10 slides in one atomic request
**Phase 3:** `POST /v1/presentations/{id}:batchUpdate` — insert logos (best-effort, failures silently caught)

**Brand:** Paramount navy (`#0D1F40`) + orange (`#F27321`), Montserrat headings, Inter body text. Logos auto-fetched via Google Favicon API (`google.com/s2/favicons?sz=128`).

**Cover slide layout:** Split-panel design — left 65% content zone, right 35% branded panel (`NAVY_LIGHTER`). Panel contains client label, client logo, orange divider rule, "PARAMOUNT" label, and Paramount logo — all vertically centered. Labels/divider drawn in Phase 2; logo images inserted in Phase 3 using shared layout constants (`LOGO_X`, `COVER_CLOGO_Y`, `COVER_PLOGO_Y`).

**Closing slide layout:** Navy background, two thin orange horizontal rules bracket the CTA text, Paramount logo centered above the rules (Phase 3).

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
| slideBuilder | `src/utils/slideBuilder.ts` | `buildSlidesFromData()` — converts `ProposalData` into 10 `SlideData` cards for preview |
| contentExpander | `src/utils/contentExpander.ts` | Template-based content expansion for problems and benefits |
| validators | `src/utils/validators.ts` | Input validation functions |
| errorHandler | `src/utils/errorHandler.ts` | Centralized error logging and debugging utilities |
| llmService | `src/utils/llmService.ts` | Gemini 2.5 Flash: `analyzeBriefPdf()`, `generateProposalContent()`, `iterateProposalContent()`, `iterateDesign()` |
| googleAuth | `src/utils/googleAuth.ts` | Google OAuth 2.0 token management via GIS |
| googleSlides | `src/utils/googleSlides.ts` | Google Slides REST API — 3-phase presentation creation with theme-aware palette system |

---

## Last Updated
- Date: 2026-02-26
- Changes: Workflow audit — removed 9 dead files; integrated DesignChatInterface; cleaned mock data from exports and previews; added error/retry for AI gen; guarded step navigation; capped chat history; extracted slideBuilder util; wired Header auth state
