API → find a batch endpoint that would fix → rewrite script to accommodate → test → update directive.

---

## Documenter Sub-Agent

The Documenter sub-agent automatically reviews and documents all changes after they are made. This ensures consistent documentation and creates a traceable history of modifications.

### Documenter Workflow

After EVERY code change, the Documenter must:

1. **Review the change**
   - What file(s) were modified?
   - What was the purpose of the change?
   - Are there any breaking changes or dependencies affected?

2. **Update CHANGELOG.md** (`docs/CHANGELOG.md`)
   - Add entry under appropriate category: Added, Changed, Fixed, Removed
   - Include brief description and file reference

3. **Update COMPONENTS.md** (`docs/COMPONENTS.md`) if applicable
   - New component? Add to index
   - Changed component interface? Update documentation
   - Removed component? Remove from index

4. **Update ERRORS.md** (`docs/ERRORS.md`) if applicable
   - Encountered a new error? Document the solution
   - Found a better fix? Update existing entry

### Documenter Trigger Points

Run Documenter review after:
- Creating new files
- Modifying existing components
- Fixing bugs
- Adding new features
- Refactoring code
- Changing dependencies

### Documentation Structure

```
docs/
├── CHANGELOG.md    # Change history (what changed, when)
├── COMPONENTS.md   # Component documentation (what exists, how it works)
└── ERRORS.md       # Error reference (problems and solutions)
```

---

## Error Handling Workflow

When developing locally and encountering errors:

### 1. Check the DevTools Panel
- Click the 🛠️ button (bottom-right in dev mode)
- View logged errors with timestamps and context
- Errors are categorized: runtime, network, validation, api

### 2. Use the Error Handler Utilities
```typescript
import { logError, safeRequest, debugState } from './utils/errorHandler';

// Log errors with context
logError(error, 'api', { endpoint: '/api/slides' }, 'GoogleSlidesButton');

// Wrap async requests safely
const { data, error } = await safeRequest(() => fetch('/api/...'));

// Debug state during development
debugState('proposal', proposalData);
```

### 3. Consult ERRORS.md
- Search for similar errors
- Follow documented solutions
- Add new solutions when you fix novel errors

### 4. Self-Annealing Loop for Errors
1. Encounter error
2. Debug and fix
3. Document in ERRORS.md
4. Update code to prevent recurrence
5. System is now stronger

---

**3. Update directives as you learn**
Directives are living documents. When you discover API constraints, better approaches, common errors, or timing expectations—update the directive. But don't create or overwrite directives without asking unless explicitly told to. Directives are your instruction set and must be preserved (and improved upon over time, not extemporaneously used and then discarded).

## Self-annealing loop

Errors are learning opportunities. When something breaks:
1. Fix it
2. Update the tool
3. Test tool, make sure it works
4. Update directive to include new flow
5. System is now stronger

## File Organization

**Deliverables vs Intermediates:**
- **Deliverables**: Google Sheets, Google Slides, or other cloud-based outputs that the user can access
- **Intermediates**: Temporary files needed during processing

**Directory structure:**
- `.tmp/` - All intermediate files (dossiers, scraped data, temp exports). Never commit, always regenerated.
- `execution/` - Python scripts (the deterministic tools)
- `directives/` - SOPs in Markdown (the instruction set)
- `.env` - Environment variables and API keys
- `credentials.json`, `token.json` - Google OAuth credentials (required files, in `.gitignore`)

**Key principle:** Local files are only for processing. Deliverables live in cloud services (Google Sheets, Slides, etc.) where the user can access them. Everything in `.tmp/` can be deleted and regenerated.

## Summary

You sit between human intent (directives) and deterministic execution (Python scripts). Read instructions, make decisions, call tools, handle errors, continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.