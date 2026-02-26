# Component Documentation

Auto-generated documentation for all React components in the Paramount application.

---

## Component Index

| Component | Location | Purpose |
|-----------|----------|---------|
| App | `src/App.tsx` | 4-step flow orchestrator: Draft → Iteration → Design → Share |
| Header | `src/components/Header.tsx` | Application header with branding |
| BriefEditor | `src/components/BriefEditor.tsx` | Free-form brief text input (Step 1 paste mode) |
| PdfUploader | `src/components/PdfUploader.tsx` | PDF drag-drop upload; calls `analyzeBriefPdf()` for real Gemini extraction; fires `onTextExtracted` |
| ChatInterface | `src/components/ChatInterface.tsx` | **(new)** Step 2 chatbot — multi-turn Gemini conversation for refining proposal content; fires `onExpansionsUpdated` |
| SlidePreview | `src/components/SlidePreview.tsx` | Step 3 preview — renders 10 slide cards from real `ProposalData`; falls back to static T-Mobile demo |
| GoogleSlidesButton | `src/components/GoogleSlidesButton.tsx` | Step 3 export — auth → LLM → Slides; accepts `preGeneratedContent` + `onSuccess` callback |
| ProgressStepper | `src/components/ProgressStepper.tsx` | 4-step stepper (Draft/Iteration/Design/Share); completed steps are clickable |
| DocumentPreview | `src/components/DocumentPreview.tsx` | Live brief preview (tabs: Preview / Structure / Settings) |
| ErrorBoundary | `src/components/ErrorBoundary.tsx` | React error boundary with fallback UI |
| DevTools | `src/components/DevTools.tsx` | Floating dev panel for error viewing (dev only) |

---

## Component Details

### App.tsx
**Purpose:** Main application component that orchestrates the proposal workflow.

**State Management:** Uses `useProposalState` hook for centralized state.

**Workflow Steps:**
1. Draft (brief input via paste or PDF upload) → 2. Iteration (AI chat to refine content) → 3. Design (slide preview + Google Slides export) → 4. Share (mailto link with Slides URL)

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
- `onSuccess` — Callback fired after successful slide creation; used by `App.tsx` to advance to the Share step

**State machine:** `idle → authenticating → generating → creating → done | error`

**Flow:**
1. User clicks button → `getValidToken()` triggers Google OAuth popup
2. LLM generates personalized problem/benefit expansions via Gemini (skipped if `preGeneratedContent` provided)
3. `createGoogleSlidesPresentation()` creates presentation via Google Slides REST API
4. "Open in Google Slides" link appears; `onSuccess` callback fires to advance to Step 4

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
- `createGoogleSlidesPresentation(data: ProposalData, accessToken: string): Promise<CreateSlidesResult>`

**Phase 1:** `POST /v1/presentations` — create empty presentation
**Phase 2:** `POST /v1/presentations/{id}:batchUpdate` — build all 10 slides in one atomic request
**Phase 3:** `POST /v1/presentations/{id}:batchUpdate` — insert logos (best-effort, failures silently caught)

**Brand:** Paramount navy (`#0D1F40`) + orange (`#F27321`), Montserrat headings, Inter body text. Logos auto-fetched via Google Favicon API (`google.com/s2/favicons?sz=128`).

**Cover slide layout:** Split-panel design — left 65% content zone, right 35% branded panel (`NAVY_LIGHTER`). Panel contains client label, client logo, orange divider rule, "PARAMOUNT" label, and Paramount logo — all vertically centered. Labels/divider drawn in Phase 2; logo images inserted in Phase 3 using shared layout constants (`LOGO_X`, `COVER_CLOGO_Y`, `COVER_PLOGO_Y`).

**Closing slide layout:** Navy background, two thin orange horizontal rules bracket the CTA text, Paramount logo centered above the rules (Phase 3).

**Returns:** `{ presentationId, presentationUrl, title }`

---

### GammaPromptGenerator.tsx _(deprecated — no longer rendered)_
**Purpose:** (Retained in codebase but replaced by GoogleSlidesButton.) Generates a coffee-themed 10-slide creative agency deck prompt for "Look After You" optimized for Gamma.

**Slide Structure (historical):**
1. Executive Brew — Vision & Impact
2. The Grind — Current Challenges
3. The Perfect Blend — Look After You's Strategic Approach
4. Customer Journey Roast — Experience Reimagined
5. Data Espresso Shot — Unified Customer Intelligence
6. Personalization Pour-Over — AI in Action
7. Brew Plan — 4-Month Delivery Roadmap
8. Investment Recipe — Budget & ROI Alignment
9. Flavor Profile — Success Metrics & Impact
10. The Last Sip — Why Look After You & Next Steps

---

### Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| useBriefParser | `src/hooks/useBriefParser.ts` | Parses free-form text into structured ProposalData |
| useProposalState | `src/hooks/useProposalState.ts` | Manages proposal state and workflow transitions |

---

### Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| contentExpander | `src/utils/contentExpander.ts` | Expands brief content into full sections |
| validators | `src/utils/validators.ts` | Input validation functions |
| errorHandler | `src/utils/errorHandler.ts` | Centralized error logging and debugging utilities |
| llmService | `src/utils/llmService.ts` | Gemini 2.5 Flash integration: `analyzeBriefPdf()` (Vision PDF extraction), `generateProposalContent()` (problem/benefit expansions), `iterateProposalContent()` (multi-turn chat refinement) |

---

## Last Updated
- Date: 2026-02-26
- Changes: Added Gemini Vision PDF analysis (`analyzeBriefPdf`); replaced fake PdfUploader animation with real extraction; added `ChatInterface` component (Step 2 AI iteration); added `iterateProposalContent()` and `ChatMessage` to `llmService`; redesigned App into 4-step flow (Draft → Iteration → Design → Share); `SlidePreview` now accepts real `data` prop; `GoogleSlidesButton` adds `preGeneratedContent` and `onSuccess` props; `Step` type updated to `draft | iterate | design | share`
