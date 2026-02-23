# Component Documentation

Auto-generated documentation for all React components in the Paramount application.

---

## Component Index

| Component | Location | Purpose |
|-----------|----------|---------|
| App | `src/App.tsx` | Main application wrapper and state orchestration |
| Header | `src/components/Header.tsx` | Application header with branding |
| Layout | `src/components/Layout.tsx` | Page layout wrapper |
| BriefEditor | `src/components/BriefEditor.tsx` | Free-form brief text input |
| InputModeSelector | `src/components/InputModeSelector.tsx` | Toggle between input modes |
| TranscriptInput | `src/components/TranscriptInput.tsx` | Transcript/paste input handler |
| StructuredForm | `src/components/StructuredForm.tsx` | Structured data entry form |
| ContentEditor | `src/components/ContentEditor.tsx` | Edit expanded content |
| DocumentPreview | `src/components/DocumentPreview.tsx` | Real-time proposal preview |
| ProposalReview | `src/components/ProposalReview.tsx` | Final review before generation |
| GenerateButton | `src/components/GenerateButton.tsx` | Triggers PandaDoc generation (supports `statusMessage` prop for progress) |
| GoogleSlidesButton | `src/components/GoogleSlidesButton.tsx` | Creates Google Slides presentations via API (replaces GammaPromptGenerator) |
| ProgressStepper | `src/components/ProgressStepper.tsx` | Workflow step indicator |
| SuccessScreen | `src/components/SuccessScreen.tsx` | Post-generation success view |
| ErrorBoundary | `src/components/ErrorBoundary.tsx` | React error boundary with fallback UI |
| DevTools | `src/components/DevTools.tsx` | Floating dev panel for error viewing (dev only) |

---

## Component Details

### App.tsx
**Purpose:** Main application component that orchestrates the proposal workflow.

**State Management:** Uses `useProposalState` hook for centralized state.

**Workflow Steps:**
1. Input → 2. Expand → 3. Review → 4. Success

---

### GoogleSlidesButton.tsx
**Purpose:** Direct Google Slides API integration — creates a 10-slide presentation in the user's Google Drive and provides a link to open/edit it.

**Props:**
- `data: Partial<ProposalData> | null` — Parsed brief data
- `briefText: string` — Raw brief text (passed to LLM for content generation)
- `isEmpty: boolean` — Disables button when no brief is entered

**State machine:** `idle → authenticating → generating → creating → done | error`

**Flow:**
1. User clicks button → `getValidToken()` triggers Google OAuth popup
2. LLM generates personalized problem/benefit expansions via OpenAI
3. `createGoogleSlidesPresentation()` creates presentation via Google Slides REST API
4. "Open in Google Slides" link appears pointing to the created presentation

**10-slide structure:** Title, Challenge (problems list), Problem Deep Dives ×3, Solution (benefits list), Benefit Deep Dives ×2, Investment & Timeline, Closing CTA

**Utilities used:**
- `src/utils/googleAuth.ts` — OAuth token management
- `src/utils/googleSlides.ts` — Slides API calls
- `src/utils/llmService.ts` — OpenAI content generation
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

**Purpose:** Creates Google Slides presentations via REST API using a two-phase approach.

**Exports:**
- `createGoogleSlidesPresentation(data: ProposalData, accessToken: string): Promise<CreateSlidesResult>`

**Phase 1:** `POST /v1/presentations` — create empty presentation
**Phase 2:** `POST /v1/presentations/{id}:batchUpdate` — build all 10 slides in one atomic request

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
| pandadoc | `src/utils/pandadoc.ts` | PandaDoc API integration |
| contentExpander | `src/utils/contentExpander.ts` | Expands brief content into full sections |
| validators | `src/utils/validators.ts` | Input validation functions |
| errorHandler | `src/utils/errorHandler.ts` | Centralized error logging and debugging utilities |
| llmService | `src/utils/llmService.ts` | OpenAI GPT-4o integration for generating personalized problem/benefit expansions |

---

## Last Updated
- Date: (Auto-updated by Documenter)
- Changes: Initial documentation structure
