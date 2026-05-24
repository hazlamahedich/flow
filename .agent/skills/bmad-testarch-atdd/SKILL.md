---
name: bmad-testarch-atdd
description: 'Generate red-phase acceptance test scaffolds using the TDD cycle. Use when the user says "lets write acceptance tests" or "I want to do ATDD"'
---

## Available Scripts

- **`scripts/resolve-customization.py`** -- Resolves customization from three-layer TOML merge (user > team > defaults). Outputs JSON.
- **`references/phoenix-atdd-handoff.md`** -- When stack detection finds `mix.exs` with Phoenix/Ecto deps and no frontend tooling, hand off to the `phoenix-atdd` skill instead of generating TypeScript scaffolds.

## Phoenix / Elixir Projects

When `bmad-testarch-atdd` detects an Elixir/Phoenix backend (via `mix.exs` with `:phoenix` or `:ecto` deps and no Playwright/Cypress config), do **not** follow the TypeScript/Playwright red-phase subagent workflow. Instead:

1. Load the **`phoenix-atdd`** skill.
2. Generate ExUnit `.exs` test scaffolds with `@moduletag :skip`.
3. Create `test/support/atdd_stubs.ex` and add `log_in_user/2` stub to ConnCase so scaffolds compile before contexts exist.
4. Run `mix test` — expect `0 failures, N skipped`.

The generic `bmad-testarch-atdd` workflow assumes `playwright.config.*` or `cypress.config.*` and will produce unusable TypeScript scaffolds for Elixir codebases.

## Resolve Customization

Resolve `inject` and `additional_resources` from customization:
Run: `python3 scripts/resolve-customization.py bmad-testarch-atdd --key inject --key additional_resources`
Use the JSON output as resolved values.

1. **Inject before** -- If `inject.before` resolved to a non-empty value, prepend it to your active instructions and follow it.
2. **Available resources** -- Note the `additional_resources` list. Do not read these files now; they are available for the injected prompt or workflow steps to reference when needed.

Follow the instructions in [workflow.md](workflow.md).

## Post-Workflow Customization

After the workflow completes, resolve `inject.after` from customization:
Run: `python3 scripts/resolve-customization.py bmad-testarch-atdd --key inject.after`

If resolved `inject.after` is not empty, append it to your active instructions and follow it.
