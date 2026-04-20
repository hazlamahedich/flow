# Code Style & Conventions

## TypeScript
- Strict mode: `noUncheckedIndexedArrayAccess`, `exactOptionalPropertyTypes`
- No `any` — use `unknown` + type guards. No `@ts-ignore`/`@ts-expect-error`
- `interface` for object shapes, `type` for unions/intersections
- `satisfies` operator for type validation without widening
- `async/await` over `.then()` chains
- Named exports only (default exports only for Next.js page components)

## Naming
| Category | Convention | Example |
|---|---|---|
| Utility files | `kebab-case.ts` | `format-currency.ts` |
| Components | `PascalCase.tsx` | `InvoiceList.tsx` |
| Server Actions | `actions/{verb}-{entity}.ts` | `actions/create-client.ts` |
| Hooks | `use{Feature}{Action}` | `useClientList` |
| Booleans | `is/has/should/can` prefix | `isActive` |
| Event handlers | `handle{Event}` / `on{Event}` props | `handleSubmit` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| DB tables/columns | `snake_case` | `workspace_members` |
| Zod schemas | `{entity}Schema` | `invoiceSchema` |
| Agent types | `{AgentName}Proposal` | `ArCollectionProposal` |
| RLS policies | `policy_{table}_{operation}_{role}` | `policy_invoices_select_member` |

## File Organization
- Feature-based within route groups: `/app/(workspace)/clients/`, `/app/(workspace)/invoices/`
- Each feature: `page.tsx`, `loading.tsx`, `error.tsx`, `actions/`, `components/`, `__tests__/`
- Agent modules: `packages/agents/{agent-name}/` with `index.ts`, `executor.ts`, `pre-checks.ts`, `schemas.ts`, `types.ts`, `__tests__/`
- 200 lines per file soft limit (250 hard limit)
- 50 lines for pure logic functions, 80 for React components

## Import Order
1. React/Next.js → 2. Third-party → 3. Internal packages → 4. Local hooks/utils → 5. Components → 6. Types → 7. Styles

## Agent Module Contract
- Exports: `execute()`, `preCheck()`, input/output types, Zod schemas
- Pre-checks are deterministic code (never LLM calls)
- ActionResult: `{ success: true; data: T } | { success: false; error: AppError }`

## Financial Data
- All monetary values as **integers in cents** — never float
- Invoice totals computed from line items, never stored
- Stripe amounts in cents, mapped at integration boundary

## Testing Conventions
- Test files colocated: `component.test.tsx` next to `component.tsx`
- Integration tests in `__tests__/` at route-group level
- E2E in `apps/web/e2e/`
- Test names describe scenario: `it('rejects invoice with mismatched line item totals')`
- Financial assertions use exact cent values
