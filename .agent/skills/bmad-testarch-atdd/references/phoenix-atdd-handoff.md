# Phoenix ATDD Handoff — from bmad-testarch-atdd

## When to use this handoff

`bmad-testarch-atdd` stack detection finds `mix.exs` with Phoenix/Ecto and no `playwright.config.*`. The generic workflow produces TypeScript scaffolds — completely wrong for Elixir. Read this summary, then switch to the **`phoenix-atdd`** skill.

## What bmad-testarch-atdd got wrong for Phoenix

- Tries to generate `tests/api/*.spec.ts` and `tests/e2e/*.spec.ts` — these are web JS test paths, not ExUnit.
- `test.skip()` doesn't exist in ExUnit; `@moduletag :skip` does.
- References `playwright-utils`, `data-factories.md`, `component-tdd.md` — none of which apply.
- Missing: ConnCase login stub, ATDD compilation stubs, knowledge of `ExUnit.CaseTemplate`.

## What phoenix-atdd does instead

- Generates `test/leadforge_ai/*_test.exs` (DataCase) and `test/leadforge_ai_web/controllers/*_test.exs` (ConnCase).
- Uses `@moduletag :skip` for entire module red phase.
- Requires `test/support/atdd_stubs.ex` to make scaffolds compile before contexts are generated.
- Requires a `log_in_user/2` stub in ConnCase (for controller tests that need auth before `phx.gen.auth` is run).
- Supports `async: false` for transaction/RLS tests.
- Run `mix test` — expect `0 failures, N skipped`.

## Quick migration

If `bmad-testarch-atdd` has already generated TypeScript scaffolds, delete them and re-run with `phoenix-atdd`:

```bash
# Remove wrong scaffolds
rm -f tests/api/*.spec.ts tests/e2e/*.spec.ts

# Run Phoenix ATDD instead
# (handled by the phoenix-atdd skill)
```

## Related skills

- `phoenix-atdd` — primary skill for Phoenix red-phase scaffolds
- `bmad-testarch-atdd` — only useful for JS/TS stacks; skip for Elixir
