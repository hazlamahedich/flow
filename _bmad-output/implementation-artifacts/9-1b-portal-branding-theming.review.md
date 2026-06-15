# Adversarial Review: Story 9.1b — Portal Branding & Theming

**Date:** 2026-06-16
**Review Type:** Party Mode (multi-agent independent subagents)
**Reviewers:** Winston (🏗️ Architect), Murat (🧪 Test Architect), Mary (📊 Business Analyst), Sally (🎨 UX Designer)
**Trigger:** User request: "party mode adversarial review and validate story 9-1b"
**Original Status:** BLOCKED — not ready for dev
**Current Status:** RESOLVED via spec/ATDD/layout edits — returned to ready-for-dev on 2026-06-16

---

## Resolution Log

| # | Blocker | Resolution | Evidence |
|---|---|---|---|
| 1 | Server Component + React Context contradiction | Split into `PortalBrandingStyle` (Server Component, style injection) and `PortalBrandingProvider` (Client Component, Context) | Story T2.1–T2.2, ATDD-005/006 |
| 2 | Conditional `next/font` loading | Static import in `apps/web/app/portal/fonts.ts` with preset-to-font mapping | Story T2.4, Dev Notes §Font loading |
| 3 | Weak `brandingConfigSchema` | Added hex regex, font allowlist, key allowlists, length caps | Story T1.3, ATDD-003 |
| 4 | `revalidateTag` without cache wrapper | `getPortalBranding` wrapped in `unstable_cache(..., { tags: ['portal-branding'] })` | Story T4.3 |
| 5 | ATDD spec theater | Rewrote spec to import from real (missing) modules; inline stubs removed | `apps/web/__tests__/acceptance/epic-9/9-1b-portal-branding-theming.spec.ts` |
| 6 | UX-DR traceability drift | Story/ATDD now cite UX-DR3, UX-DR4, UX-DR35; `epics.md` update noted | Story header, References |
| 7 | T4 scope bleed | Clarified as lightweight backend-only persistence for Epic 10 UI; pgTAP added | Story T4 header, T6.2 |
| 8 | Auth wording contradiction | T3.1 reworded to "validated portal session branch" (no Supabase Auth session) | Story T3.1, AC5 |
| 9 | 9-1a CSS var bug | Fixed non-existent `--flow-color-*` names to canonical `--flow-*` in layout | `apps/web/app/portal/[slug]/layout.tsx` |

---

## Executive Summary

Story 9.1b was marked `ready-for-dev` in `sprint-status.yaml`. A party-mode adversarial review found **four blocking issues** that must be resolved before implementation begins, plus multiple high-priority findings across architecture, testing, requirements, and UX. The story’s ATDD scaffold was spec theater (tests asserted inline stubs, not real modules), and the architecture as specified was internally inconsistent (Server Component + React Context + `next/font`).

**Resolution applied 2026-06-16:** the story file, ATDD scaffold, and 9-1a layout were rewritten to address every blocker. The story was returned to `ready-for-dev`. Non-blocking UX concerns (e.g., `bold-professional` clinical preset, 4 content vars) remain documented below for PM/UX triage but do not block implementation.

---

## Blocking Issues

| # | Issue | Location | Owner | Required Resolution |
|---|---|---|---|---|
| B1 | **Server Component + React Context contradiction** | Story T2.1–T2.3, AC5 | Architect / Frontend | Split into a Server Component style-injector + Client Component context provider, or pass content vars as props. React Context cannot be provided from a Server Component to interactive children. |
| B2 | **`next/font` loaded conditionally inside a runtime provider** | Story T2.4, Dev Notes §Font loading | Architect / Frontend | Move font loading to static module imports. Map preset `fontHeading`/`fontBody` values to pre-loaded font class names/variables. `next/font` cannot be called per-render. |
| B3 | **`brandingConfigSchema` validation is insufficient** | Story T1.3, ATDD lines 53–63 | Architect / QA | Add hex regex validation, font allowlist, key allowlists, and string length caps. Arbitrary strings for colors/fonts/content are unsafe. |
| B4 | **`revalidateTag('portal-branding')` has no cached layer** | Story T4.2–T4.3 | Architect | Define the `unstable_cache` wrapper that the tag invalidates, or remove `revalidateTag` and rely on Server Component re-renders. |
| B5 | **ATDD scaffold is spec theater, not test-first** | ATDD file lines 17–63 | QA | Rewrite tests to import from real (currently non-existent) modules so they fail until implementation exists. Remove inline stubs. |
| B6 | **UX-DR traceability drift** | Story AC1–AC3, ATDD header, `epics.md` glossary | PM / Tech Writer | Reconcile UX-DR12/26/35 citations against `epics.md` glossary before dev. |
| B7 | **Scope bleed: persistence layer in a theming slice** | Story T4 | PM | Decide whether `portal_branding` jsonb column + save action belongs in 9-1b or Epic 10. |
| B8 | **Auth contradiction in layout wiring** | Story AC5 vs. T3.1 | PM / Architect | Clarify whether the portal layout wraps an authenticated branch or renders without Supabase Auth session. |

---

## Detailed Findings

### 🏗️ Winston — Architecture

1. **Runtime `<style>` injection vs. generated CSS**
   - Story mandates `dangerouslySetInnerHTML` scoped under `[data-portal-branding]`.
   - Adds XSS surface if schema is bypassed; static CSS layer in `@flow/tokens` is safer and cacheable.
   - Acceptable for MVP only with strict validation and documented tech-debt path.

2. **Server Component + Context — BLOCKING**
   - A Server Component cannot create/provide React Context consumed by Client Components.
   - The story asks for a “Server Component-capable provider” that exposes content vars via Context. This is impossible as written.
   - Fix: split into `PortalBrandingStyle` (Server Component, emits `<style>`) and `PortalBrandingProvider` (Client Component, provides Context), or avoid Context for content vars.

3. **Resolver silent failure for unknown presets**
   - `resolveBrandingPreset` returns overrides/empty maps for unknown preset names.
   - A typo silently drops the entire default brand set; should log at minimum and ideally fall back to the default preset at render time.

4. **Schema validation gaps — BLOCKING**
   - `z.record(z.string())` accepts any keys, any strings, any length.
   - No hex validation, font allowlist, key allowlist, or content length caps.
   - Risk: invalid CSS values, XSS through content strings, DB bloat.

5. **`next/font` misuse — BLOCKING**
   - Font selection based on runtime preset cannot call `next/font/google` inside the provider.
   - Playfair Display must be statically imported and mapped via CSS variable/class.

6. **Module placement**
   - Pure logic (`constants`, `presets`, `schema`, `resolve`) should live in `packages/shared` per Epic 8 retro B6, not `apps/web/lib/portal-branding/`.
   - Only the React component belongs in `apps/web/app/portal/components/`.

7. **CSS variable naming reconciliation**
   - 9-1a layout currently uses `--flow-color-bg-primary`, `--flow-color-text-primary`, `--flow-color-text-tertiary`, `--flow-color-border-default`.
   - `packages/tokens/src/css/generated-themes.css` emits `--flow-bg-canvas`, `--flow-text-primary`, `--flow-text-muted`, `--flow-border-default`.
   - 9-1a layout is therefore broken; 9-1b must fix it. Story needs explicit remap checklist and automated test, not manual browser verification.

8. **Cache invalidation contract undefined**
   - `revalidateTag('portal-branding')` exists in save action but read helper has no `unstable_cache` wrapper.
   - Without explicit cache layer, the tag is theater.

### 🧪 Murat — Test / QA

1. **Red scaffold tests stubs, not real modules**
   - `PORTAL_LIGHT_THEME`, `PORTAL_BRANDING_PRESETS`, `resolveBrandingPreset`, and `brandingConfigSchema` are defined inline inside the spec.
   - All 19 tests pass because they assert the test author’s own code, not the production code.
   - Required: remove inline definitions; import from `@/lib/portal-branding/*` and `@/app/portal/components/PortalBrandingProvider`.

2. **Provider test is vacuous**
   - Only asserts the mocked function is defined and is a function.
   - Needs render assertions: children render, `<style>` block present, wrapper carries selector, content vars reachable via context.

3. **Resolver contract too weak**
   - No assertion that `resolveBrandingPreset('minimalist', {})` returns exactly 8 visual + 4 content keys.
   - No assertion that overrides preserve other preset values.
   - No unknown-preset fallback test.

4. **Boundary tests incomplete**
   - Tests 9/5 reject and 8/4 accept, but miss 0/0, 7/3, missing optional objects, and invalid keys.

5. **Coverage gaps**
   - Hydration mismatch, FOUT/font loading, CSS var scoping, persistence round-trip, RLS for `portal_branding` jsonb, WCAG contrast.

6. **AC0 red-phase commit SHA unauditable**
   - No CI gate or close-out script enforces that the first failing commit exists.

7. **pgTAP absence not justified**
   - A new jsonb column in `workspaces` must be covered by existing RLS tests. Add tests proving owner/admin can update and member/anon cannot.

8. **P1 visual regression missing**
   - Epic 9 planning review §8.2 lists visual regression as P1 for 9-1b, but ATDD has no snapshot/scaffold.

### 📊 Mary — Requirements / Business Analysis

1. **Traceability drift — BLOCKING**
   - Story/ATDD cite UX-DR12 (presets), UX-DR26 (palette), UX-DR35 (trophy case).
   - `epics.md` glossary maps UX-DR12 → CommandPalette, UX-DR26 → Accordion reasoning, UX-DR35 → trophy case.
   - UX-DR26 has nothing to do with a light theme palette. PRD glossary or story numbers must be corrected.

2. **Default preset contradicts user story**
   - User story promises “warm, premium, branded light theme” and “trophy case.”
   - Default is `minimalist` (same colors but Inter/4px/16px/circle), while `warm-host` (Playfair/8px/24px/rounded) better delivers the warmth.
   - Consider making `warm-host` the default.

3. **T4 persistence bleeds into Epic 10**
   - Scope boundaries say full branding-settings UI is Epic 10, but T4 adds migration + Server Action + read helper.
   - Decide: is 9-1b read-only render with default config, or does it own persistence?

4. **Auth contradiction — BLOCKING**
   - AC5: provider renders without Supabase Auth session (FR51).
   - T3.1: wrap the “authenticated `<main>` branch.”
   - Portal has no account; clarify the language.

5. **Unknown preset tolerance is overreach**
   - Silent fallback to empty maps is not in source PRD or planning review.
   - Should reject at save and fall back to default at render.

6. **8/4 caps lack business justification**
   - No visible rationale in PRD/UX spec for exactly 8 visual + 4 content variables.

7. **9-1b hard-depends on 9-1a**
   - Planning review says 9-1b can run concurrently with 9-2 and 9-3b, but the story extends the 9-1a layout and depends on its CSS var names.

8. **Value vs. effort**
   - 9-1b is mostly aesthetic until 9-2 delivers content. T4 backend work could be deferred to Epic 10.

### 🎨 Sally — UX / Brand

1. **Palette alone does not guarantee premium feel**
   - `#FAFAF8` / `#D4A574` / `#E8E0D8` can read as generic beige without shadow, texture, or generous whitespace.
   - ATDD’s `/^#FA/` test is a format check, not a brand-feel test.

2. **`bold-professional` contradicts philosophy**
   - Uses `#FFFFFF` surface and `#1A1A1A` accent — clinical black-on-white.
   - If curated presets should never be clinical, this preset undermines the brand promise.

3. **Playfair Display FOUT not fully mitigated**
   - `font-display: swap` causes visible layout shift/reflow.
   - Needs preload hints or size-adjusted fallback metrics.

4. **Flash-of-unthemed-content risk**
   - `[data-portal-branding]` injection can show unstyled DOM for a frame if style block is not first.
   - Also 9-1a already uses wrong `--flow-color-*` names, so two broken layers exist.

5. **Four content variables are reductive**
   - Greeting/tagline/CTA/footer force a templated voice; real brand needs more copy hooks.

6. **Progressive enhancement not designed**
   - Content vars via Context fail for JS-off users; defaults must be server-renderable.

7. **Low-contrast accent not enforced**
   - `#D4A574` on `#FAFAF8` fails WCAG AA for text; story admits it but does not prevent text usage.

8. **“Powered by Flow OS” footer conflicts**
   - Preserving the attribution badge in a “fully branded” portal undermines the VA brand illusion.

---

## Grounded Code Finding

Current `apps/web/app/portal/[slug]/layout.tsx` references non-existent CSS variables:
- `--flow-color-bg-primary`
- `--flow-color-text-primary`
- `--flow-color-text-tertiary`
- `--flow-color-text-secondary`
- `--flow-color-border-default`

`packages/tokens/src/css/generated-themes.css` emits:
- `--flow-bg-canvas: #fafaf8`
- `--flow-text-primary: #1a1917`
- `--flow-text-muted: #6e6c63`
- `--flow-border-default: #e8e6e1`

Therefore the 9-1a layout already has broken theming. Story 9-1b’s CSS naming reconciliation is a bug fix, not just cleanup.

---

## Recommendations

### Required before `in-progress` — DONE

All blocking issues were resolved by editing the story file, ATDD scaffold, and 9-1a layout.

### Remaining non-blocking UX concerns for PM/UX triage

1. **`bold-professional` preset is clinical** — preserved as an opt-in curated preset. PM/UX can decide to neuter or rename it later; default is now `warm-host`.
2. **Four content variables are reductive** — kept as the design-system token set for 9-1b. Epic 10 settings UI can expand copy hooks if needed.
3. **"Powered by Flow OS" footer brand conflict** — preserved per UX-DR38; PM can revisit as part of viral acquisition strategy.
4. **Contrast enforcement** — moved from advisory to a test/lint rule requiring `--portal-accent` only on non-text elements.

### Sprint impact — UPDATED

- `9-1b-portal-branding-theming` status returned to `ready-for-dev` after resolution.
- 9-1a layout CSS var bug was fixed as part of 9-1b T3.2 (latent bug in a dependency).
- 9-2, 9-3b remain parallelizable; they do not hard-depend on 9-1b styling.

---

## Next Steps — COMPLETED

1. ✅ PM/Architect scope decisions applied (T4 stays as lightweight backend-only persistence; default preset changed to `warm-host`).
2. ✅ Tech-writer note added: `epics.md` Story 9.1 ACs should cite UX-DR3/UX-DR4/UX-DR35.
3. ✅ Architect rewrote provider/font/cache sections.
4. ✅ QA rewrote ATDD scaffold.
5. ✅ `sprint-status.yaml` updated and linked to this review.

---

**Generated by BMAD Party Mode + OpenCode** — 2026-06-16
**Resolution applied by OpenCode** — 2026-06-16
