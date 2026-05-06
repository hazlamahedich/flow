# Story 4.4: Action Item Extraction & Draft Responses

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want action items extracted from emails with draft responses,
So that I can quickly handle urgent items without starting from scratch.

## Acceptance Criteria

1.  **AC1 — Action Item Extraction (FR28d):** For emails categorized as `urgent` or `action`, the agent must extract structured action items: `task`, `meeting`, `payment`, or `deadline`. Each item includes a description, and where applicable, a `due_date` (ISO string) and `contact` (email/name).
2.  **AC2 — Draft Response Activation (FR28d):** When Inbox Agent trust level for `draft_quick_reply` is ≥ 2, the agent must generate a draft response for `urgent` and `action` emails. The draft must be stored in `email_categorizations.draft_reply`.
3.  **AC3 — Writing Style Learning (FR28f):** The drafting engine must use the `voice_profile` (from agent config) and `per_client_tone` (from client settings) for few-shot prompting. Approved/edited drafts must be tracked to update the voice profile (via weekly background job, out of scope for 4.4 immediate task but mechanism must exist).
4.  **AC4 — Trust Metric: Recategorization (FR28e):** Implement a tracking mechanism for manual recategorizations. If a user corrects a category, emit an `email.categorization_corrected` signal. Recategorization rate (corrected/total) is the primary trust metric for the Inbox Agent.
5.  **AC5 — Adaptive Inbox Density (UX-DR7):** The `ApprovalQueue` grid must adapt its density based on item count:
    - 0-3 items: generous spacing (gap-8, p-6).
    - 4-12 items: standard spacing (gap-4, p-4) with urgency badges.
    - 13+ items: collapsed clusters (gap-2, p-2) with priority-first sort.
6.  **AC6 — "Handled Quietly" Section (UX-DR27):** Items categorized as `info` or `noise` at trust level ≥ 3 must be rendered in a separate "Handled overnight" section with a gold accent divider and collapsed green item indicators.
7.  **AC7 — Mobile Triage (UX-DR51, UX-DR53):** On mobile viewports (< 768px):
    - Items render as condensed cards with swipe gestures (Left: Archive/Reject, Right: Approve).
    - Detail pane (reasoning/actions) converts to a full-page overlay instead of an inline accordion.
8.  **AC8 — Flood State Handling (UX-DR25):** At 147+ items, the inbox enters "Batch Mode": items are grouped by sender/urgency with a single "Approve All" or "Review Cluster" action.
9.  **AC9 — Cross-Client Isolation (NFR16a):** Drafting and extraction must strictly follow the `ContextBoundary` pattern. One client's email content and voice settings must never leak into another client's draft generation pass.

## Developer Context

### Group A: Type System & Schema Enhancements

- [ ] Task 1: Update `packages/agents/inbox/schemas.ts`
  - [ ] 1.1 Add `ExtractedAction` interface:
    ```typescript
    export interface ExtractedAction {
      type: 'task' | 'meeting' | 'payment' | 'deadline';
      description: string;
      due_date?: string;
      contact?: string;
    }
    ```
  - [ ] 1.2 Update `InboxProposal` interface to include `extracted_actions` and `draft_reply`.
  - [ ] 1.3 Update `inboxProposalSchema` to validate these new fields.
  - [ ] 1.4 Export a `voiceProfileSchema` for the agent config.

### Group B: Enhanced Categorization & Extraction

- [ ] Task 2: Update `packages/agents/inbox/categorizer.ts`
  - [ ] 2.1 Update `CATEGORIZATION_SYSTEM_PROMPT` to include instructions for extraction and output schema changes.
  - [ ] 2.2 Modify `categorizeEmail` to handle the expanded response schema.
  - [ ] 2.3 Ensure extraction only runs for `urgent` and `action` categories to save tokens/latency.

### Group C: Drafting Engine

- [ ] Task 3: Create `packages/agents/inbox/drafter.ts`
  - [ ] 3.1 Implement `generateDraftReply(emailContent: string, context: DraftContext)`:
    - Load `voice_profile` from workspace agent config.
    - Load `client_tone` and `client_name`.
    - Construct few-shot prompt with examples from `voice_profile`.
    - Use `llm-router` with `taskTier: 'balanced'` (need quality for drafts).
  - [ ] 3.2 Implement isolation check: assert `context.clientId` matches data being processed.

### Group D: Trust & Signals

- [ ] Task 4: Implement Recategorization Tracking
  - [ ] 4.1 Update `apps/web/app/(workspace)/agents/approvals/actions/` (or create new) to handle manual category corrections.
  - [ ] 4.2 Action must update `email_categorizations` (`is_corrected`, `corrected_category`) and emit `email.categorization_corrected` signal.

### Group E: UI Implementation (Approval Queue)

- [ ] Task 5: Update `ProposalCard`
  - [ ] 5.1 Implement `InboxProposalContent` sub-component.
  - [ ] 5.2 Render extracted actions as a list of chips/labels with icons.
  - [ ] 5.3 Render `draft_reply` in an editable textarea within the expanded view.
  - [ ] 5.4 Use `framer-motion` (or similar if already in project) for mobile swipe gestures.

- [ ] Task 6: Adaptive Grid & Flood State
  - [ ] 6.1 Update `ApprovalQueue.tsx` to compute density classes based on `items.length`.
  - [ ] 6.2 Implement "Handled Quietly" section at the bottom of the list.
  - [ ] 6.3 Implement Batch Mode grouping logic for 147+ items.

### Group F: Testing

- [ ] Task 7: Extraction Unit Tests
  - [ ] 7.1 Verify extraction of multiple tasks and dates from a single email.
  - [ ] 7.2 Verify `null` extraction for `noise` emails.
- [ ] Task 8: Drafting Unit Tests
  - [ ] 8.1 Verify draft tone shifts based on `per_client_tone` input.
  - [ ] 8.2 Verify `voice_profile` examples are present in the final prompt (mock prompt assembly).
- [ ] Task 9: UI Density & Mobile Tests
  - [ ] 9.1 Test rendering with 2, 8, and 20 items to verify CSS class shifts.
  - [ ] 9.2 Playwright test for mobile swipe gesture triggers.
- [ ] Task 10: Isolation Test
  - [ ] 10.1 Multi-client drafting test: ensure Client A's name never appears in Client B's draft.

## Technical Requirements & Guardrails

- **LLM Selection:** Use `balanced` tier (Anthropic/OpenAI) for drafts to ensure high-quality voice matching. Categorization/Extraction can stay on `fast` tier (Groq).
- **RLS:** Update actions must verify `workspace_id` and role permissions before saving corrections.
- **Performance:** Drafting is async and deferred until after categorization is confirmed (or done in parallel if trust is high). P95 < 5s for drafts.
- **File Size:** Keep components modular. Extract `DraftEditor` and `ActionList` to separate files if they exceed 100 lines.

## Previous Story Intelligence (4.3)

- Story 4.3 established the basic `email_categorizations` structure.
- Trigger.dev handles the Morning Brief, but real-time categorization happens via `gmail` webhook -> `pg-boss`.

## Project Context Reference

- React 19, Next.js 15, Tailwind v4.
- ActionResult contract for all Server Actions.
- 200-line file limit.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
