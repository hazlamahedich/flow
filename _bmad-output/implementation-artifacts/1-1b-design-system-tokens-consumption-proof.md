# Story 1.1b: Design System Tokens & Consumption Proof

Status: backlog

## Story

As a developer,
I want the design system token layer implemented with a verified consumption pattern,
So that all subsequent UI stories use a consistent, accessible, and testable design foundation.

## Dependencies

- Story 1.1a (Turborepo Scaffold & CI Pipeline) must be completed and `ready-for-dev` status confirmed.

## Acceptance Criteria

1. **`packages/tokens` exports typed JS objects and CSS custom properties** for: color primitives (gray/blue/red/green/yellow scales 50-950), semantic color aliases (bg, fg, muted, accent, destructive, border for both light and dark), typography (font family, size scale, line-height, weight), spacing (4px base unit scale), breakpoints (sm/md/lg/xl as JS constants), and focus ring tokens (ring-color, ring-width, ring-offset).
2. **Workspace dark theme values** defined under `[data-theme="dark"]`: base `#0A0A0B`, panels `#161618`, elevated `#1E1E21`. Text, border, and accent colors resolve correctly against these surfaces. [Source: UX-DR27]
3. **Light theme values** defined under `[data-theme="light"]`: surface, text, border, and accent tokens resolve to light-appropriate values. Default light palette is NOT the portal palette — that ships with Epic 9. [Source: UX-DR1]
4. **Theme switching mechanism**: `data-theme="light"` / `data-theme="dark"` on `<html>`. Exported `setTheme(name)` function sets the attribute and persists to `localStorage`. Exported `getTheme()` reads current theme. Verified by automated test. [Source: UX-DR1]
5. **6 agent identity colors** defined as permanent HSL CSS variables: Inbox (blue), Calendar (violet), AR Collection (amber), Weekly Report (green), Client Health (rose), Time Integrity (orange). Values are tokens that resolve to HSL — not hardcoded in components. [Source: UX-DR3]
6. **Semantic status colors**: green = handled, yellow = needs attention, red = act now. Defined as CSS custom properties with both light and dark variants. [Source: UX-DR20]
7. **Typography via `next/font/google`**: Inter for body/UI (13px base, defined weight scale), JetBrains Mono for timestamps/timers/agent reasoning only (12px). Configured in `apps/web/app/layout.tsx`. Font family names exposed as tokens for package consumption. [Source: UX-DR17]
8. **4px base spacing grid** with scale 4/8/12/16/24/32/48px, mapped to Tailwind spacing preset. Enforced via `packages/config` Tailwind extension. [Source: UX-DR18]
9. **Layout grid constants** in `packages/config/src/layout.ts`: sidebar 240px/56px, main max-width 960px, detail pane 360px, breakpoints 640/768/1024/1280px. Exported as typed constants. [Source: UX-DR19]
10. **Tailwind plugin** in `packages/tokens/tailwind-plugin.ts` maps CSS custom properties to Tailwind utility classes. `tailwind.config.ts` in `apps/web` imports the plugin. Consumption is via Tailwind utilities, not raw `var()` calls in components.
11. **Proof `Button` component** in `packages/ui` consumes tokens via Tailwind plugin: uses color token for bg, spacing token for padding, typography token for font, focus ring token for focus state. Primary + secondary variants. NOT a full component API — consumption proof only (~30 lines).
12. **`packages/test-utils` exports `renderWithTheme()`** helper that wraps a render in a container with `data-theme` attribute. Used by Button test. This is the first real test utility.
13. **Token validation script** in `packages/tokens/scripts/validate.ts` (run in CI): asserts every defined token has a valid CSS value, no orphans in either theme, no duplicate var names. Fails CI on violation.
14. **WCAG AA contrast check** passes for all foreground/background semantic color pairs in both themes: 4.5:1 for normal text, 3:1 for large text. Automated test. Non-negotiable.
15. **Focus ring token** produces visible indicator meeting 2px minimum width + 3:1 contrast against adjacent colors in both themes.
16. **Consumption README** in `packages/tokens/README.md` documents: how to import tokens, how to use the Tailwind plugin, how to theme-switch, how to add new tokens.
17. **`turbo build && turbo test && turbo lint`** all pass across the monorepo.

## Tasks / Subtasks

- [ ] Task 1: Scaffold `apps/web` Next.js app (AC: #7)
  - [ ] 1.1 Create `apps/web` with Next.js 15 App Router via `create-next-app`
  - [ ] 1.2 Create root layout `apps/web/app/layout.tsx` with Inter + JetBrains Mono via `next/font/google`
  - [ ] 1.3 Add `apps/web` to `turbo.json` pipeline with dependency on `packages/ui`
- [ ] Task 2: Implement color token system (AC: #1, #2, #3)
  - [ ] 2.1 Create `packages/tokens/src/colors/primitives.ts` — gray/blue/red/green/yellow scales (50-950) as HSL
  - [ ] 2.2 Create `packages/tokens/src/colors/semantic.ts` — bg, fg, muted, accent, destructive, border aliases
  - [ ] 2.3 Create `packages/tokens/src/colors/agents.ts` — 6 permanent agent identity HSL values
  - [ ] 2.4 Create `packages/tokens/src/colors/status.ts` — handled green, attention yellow, act-now red
  - [ ] 2.5 Create `packages/tokens/src/css/dark.css` — `[data-theme="dark"]` with workspace dark values
  - [ ] 2.6 Create `packages/tokens/src/css/light.css` — `[data-theme="light"]` with light theme values
- [ ] Task 3: Implement typography tokens (AC: #1, #7)
  - [ ] 3.1 Create `packages/tokens/src/typography.ts` — font family names, size scale, line-height, weight, letter-spacing
  - [ ] 3.2 Export font family name tokens (not `next/font` objects) for package consumption
  - [ ] 3.3 Configure `next/font/google` in `apps/web/app/layout.tsx` using token font family names
- [ ] Task 4: Implement spacing and layout tokens (AC: #1, #8, #9)
  - [ ] 4.1 Create `packages/tokens/src/spacing.ts` — 4px base unit scale (0-128)
  - [ ] 4.2 Create `packages/tokens/src/breakpoints.ts` — sm/md/lg/xl as typed JS constants
  - [ ] 4.3 Create `packages/config/src/layout.ts` — sidebar/main/detail pane constants
  - [ ] 4.4 Extend Tailwind preset in `packages/config` with spacing scale and breakpoint screens
- [ ] Task 5: Implement focus ring tokens (AC: #1, #15)
  - [ ] 5.1 Create `packages/tokens/src/focus.ts` — ring-color, ring-width, ring-offset for both themes
  - [ ] 5.2 Add focus ring CSS vars to `dark.css` and `light.css`
- [ ] Task 6: Implement theme switching (AC: #4)
  - [ ] 6.1 Create `packages/tokens/src/theme.ts` — `setTheme()`, `getTheme()`, `localStorage` persistence
  - [ ] 6.2 Write test: `setTheme("dark")` → `data-theme="dark"` present → tokens resolve correctly
  - [ ] 6.3 Write test: `setTheme("light")` → `data-theme="light"` present → tokens resolve correctly
- [ ] Task 7: Build Tailwind plugin (AC: #10)
  - [ ] 7.1 Create `packages/tokens/tailwind-plugin.ts` — maps CSS vars to Tailwind utilities
  - [ ] 7.2 Configure `apps/web/tailwind.config.ts` to import plugin from `@flow/tokens`
  - [ ] 7.3 Initialize shadcn/ui in `packages/ui`
- [ ] Task 8: Create proof Button component (AC: #11)
  - [ ] 8.1 Create `packages/ui/src/components/button.tsx` — primary + secondary, consuming token-derived Tailwind classes
  - [ ] 8.2 Keep under 30 lines. No full component API. Consumption proof only.
- [ ] Task 9: Implement `renderWithTheme` helper (AC: #12)
  - [ ] 9.1 Create `packages/test-utils/src/render-with-theme.tsx` — wraps render with `data-theme` container
  - [ ] 9.2 Export from `packages/test-utils/src/index.ts`
- [ ] Task 10: Write token validation script (AC: #13)
  - [ ] 10.1 Create `packages/tokens/scripts/validate.ts` — parses CSS files, asserts valid values, no orphans, no dupes
  - [ ] 10.2 Add as CI step or vitest test
- [ ] Task 11: Write WCAG AA contrast tests (AC: #14, #15)
  - [ ] 11.1 Create `packages/tokens/src/__tests__/contrast.test.ts` — automated contrast ratio checks for all semantic pairs in both themes
  - [ ] 11.2 Create `packages/tokens/src/__tests__/focus.test.ts` — focus ring visibility check
- [ ] Task 12: Write Button consumption test (AC: #11, #12)
  - [ ] 12.1 Create `packages/ui/src/__tests__/button.test.tsx` — renders Button via `renderWithTheme()`, asserts token values applied
- [ ] Task 13: Write consumption README (AC: #16)
  - [ ] 13.1 Create `packages/tokens/README.md` — import pattern, Tailwind usage, theme switching, adding new tokens
- [ ] Task 14: Final verification (AC: #17)
  - [ ] 14.1 Run `turbo build` — all packages + app build clean
  - [ ] 14.2 Run `turbo test` — token validation, contrast, theme switch, Button render all pass
  - [ ] 14.3 Run `turbo lint` — zero errors

## Dev Notes

### Token Architecture

**3-layer system** (from UX spec, adapted for the split):

**Layer 1 — Primitive tokens** (internal, not consumed directly by components):
- Color scales (gray-50 through gray-950, etc.)
- Raw spacing values
- Raw font size values

**Layer 2 — Semantic tokens** (what components consume via Tailwind):
- `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-elevated`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`
- `--color-border-default`, `--color-border-strong`
- `--color-accent`, `--color-destructive`
- `--color-focus-ring`, `--color-focus-ring-offset`

**Layer 3 — Component tokens** (deferred to component stories):
- Button-specific, input-specific, card-specific tokens are NOT in this story

[Source: UX design spec#Token architecture]

### `next/font` and Package Boundaries

`next/font` is a Next.js-specific API that cannot be imported from non-Next.js packages. Solution:
- `packages/tokens` exports **font family name strings** (e.g., `var(--font-body)`, `var(--font-mono)`)
- `apps/web` uses `next/font/google` to load Inter and JetBrains Mono, applying CSS variable names
- Packages consume the font tokens, not the Next.js font objects
- This pattern is documented in the consumption README

### Theme Switching Mechanism

- CSS custom properties defined under `[data-theme="dark"]` and `[data-theme="light"]` selectors in CSS files
- `setTheme(name)` sets `data-theme` attribute on `<html>` and persists to `localStorage`
- `getTheme()` reads current theme from attribute or `localStorage`
- No context provider — CSS custom properties cascade natively
- No `prefers-color-scheme` media query alone — explicit opt-in required for testability

### Agent Identity Colors

| Agent | CSS Variable | Color |
|-------|-------------|-------|
| Inbox | `--agent-inbox` | Blue |
| Calendar | `--agent-calendar` | Violet |
| AR Collection | `--agent-ar` | Amber |
| Weekly Report | `--agent-report` | Green |
| Client Health | `--agent-health` | Rose |
| Time Integrity | `--agent-time` | Orange |

Colors are **identity colors** — they never change. Status overlays (green/yellow/red) are separate tokens applied on agent badges.

[Source: UX design spec#Agent visual language]

### Workspace Dark Theme

```
Base:      #0A0A0B  (near-black)
Panels:    #161618  (surfaces)
Elevated:  #1E1E21  (cards)
```

All semantic tokens (text, border, accent, etc.) must be defined to pass WCAG AA contrast against these surfaces.

[Source: UX design spec#For the workspace]

### Critical "Never Do" Rules for This Story

- No `any` types anywhere. No `@ts-ignore`. [Source: project-context.md]
- No Pages Router patterns. App Router only. [Source: project-context.md]
- No CDN font imports — use `next/font/google` exclusively. [Source: project-context.md]
- No Tailwind `dark:` toggle for theming — themes switch via `data-theme` attribute. [Source: architecture.md]
- No barrel files inside feature folders — only at package boundaries. [Source: project-context.md]
- Named exports only — default exports only for Next.js page components. [Source: project-context.md]
- No hardcoded color/spacing values in components — all via tokens. [Source: architecture.md]
- No `next/font` objects imported from packages — only font family name tokens. [Source: architecture boundary]

### Explicitly Deferred from This Story

| Item | Deferred to |
|---|---|
| Elevation / shadow tokens | Story 1.2 (Component Foundation) |
| Motion / animation tokens | Epic 2 (when animated transitions exist) |
| Z-index scale | Epic 2 (when overlay patterns emerge) |
| Border radius tokens | Story 1.2 (shadcn defaults cover initial needs) |
| Trust-density gap system (16/20/28px) | Epic 2 (requires trust levels to exist) |
| Emotional color activation rules | Each agent's own story |
| Portal warm-cream palette values | Epic 9 (Client Portal) |
| Responsive breakpoint behavior | Story 1.6 (Layout Shell) |
| `packages/trust`, `packages/editor`, `packages/agents/*` | Their respective epics |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Starter Template]
- [Source: _bmad-output/planning-artifacts/architecture.md#Monorepo Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#200-Line File Limit]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design System Foundation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Token architecture]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Agent visual language]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- [Source: docs/project-context.md#Technology Stack]
- [Source: docs/project-context.md#Framework-Specific Rules]
- [Source: docs/project-context.md#Code Quality Rules]
- [Source: docs/project-context.md#Critical Implementation Rules]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
