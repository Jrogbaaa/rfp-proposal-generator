# Documenter Sub-Agent Directive

## Purpose
Automatically review and document all code changes to maintain accurate, up-to-date documentation.

## Trigger
Run after EVERY code modification (create, edit, delete, refactor).

## Process

### Step 1: Identify Changes
```
- What files were touched?
- What type of change? (feature, fix, refactor, docs)
- Any breaking changes?
- Dependencies affected?
```

### Step 2: Update CHANGELOG.md
Location: `docs/CHANGELOG.md`

Add under `[Unreleased]` section:

```markdown
### Added
- [New feature description] - `path/to/file.tsx`

### Changed
- [Change description] - `path/to/file.tsx`

### Fixed
- [Bug fix description] - `path/to/file.tsx`

### Removed
- [Removal description] - `path/to/file.tsx`
```

### Step 3: Update COMPONENTS.md (if applicable)
Location: `docs/COMPONENTS.md`

When to update:
- New component created → Add to Component Index
- Component interface changed → Update Component Details
- Component removed → Remove from index
- New hook/utility added → Add to respective table

### Step 4: Update ERRORS.md (if applicable)
Location: `docs/ERRORS.md`

When to update:
- New error encountered and solved → Add error entry
- Better solution found → Update existing entry
- Error pattern identified → Add to Common Error Categories

## Entry Format Examples

### CHANGELOG Entry
```markdown
### Fixed
- Resolved API timeout issue in Google Slides presentation generation - `src/utils/googleSlides.ts`
```

### COMPONENTS.md Entry
```markdown
| NewComponent | `src/components/NewComponent.tsx` | Brief description of purpose |
```

### ERRORS.md Entry
```markdown
#### [Error Code/Name]
**Error:** `Exact error message`

**Causes:**
- Cause 1
- Cause 2

**Solutions:**
Step-by-step solution
```

## Quality Checks

Before completing documentation update:
- [ ] CHANGELOG reflects actual changes made
- [ ] Component index is accurate and complete
- [ ] Error solutions are tested and verified
- [ ] File paths are correct
- [ ] No duplicate entries

## Integration

The Documenter works as part of the self-annealing loop:
1. Make change
2. **Documenter reviews and documents** ← You are here
3. Test change
4. Update directives if new patterns discovered
5. System is now stronger and better documented
