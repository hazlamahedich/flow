# Post-Review Validation Checklist (bmad-review-adversarial-general)

Run this after the adversarial review findings have been patched into the story file.

## 1. Story Document Integrity
- [ ] Story `.md` file reflects ALL resolved findings (C/H/M/E)
- [ ] ACs are updated if any finding changed acceptance criteria
- [ ] Task ordering is updated if a finding restructured the implementation plan
- [ ] Dev Notes contain the fix/workaround and a reference to the review

## 2. Frontmatter & Arithmetic Sanity
- [ ] Frontmatter contains `reviewed`, `review_status`, `review_verdict`, `review_findings_count`, `review_findings_resolved` (and optionally `review_findings_informational`) — no duplicate fields in the first 20 lines
- [ ] Body text arithmetic (e.g., "14 + 3 new = 17 resolved") matches frontmatter counts
- [ ] No stale `changes-requested` verdict paired with `review_findings_resolved == review_findings_count` (must flip to `resolved`)
- [ ] `status` is `ready-for-dev` or `done`, not left at `completed`
- [ ] Sprint-status tracker entry exists and fields mirror story frontmatter

## 3. ATDD Scaffold Integrity
- [ ] All red-phase tests that were changed in the review have been saved
- [ ] Any stale/old test files from a previous iteration are identified for deletion
- [ ] `mix compile` succeeds with `@moduletag :skip` still present

## 3. Sprint Status Tracker
- [ ] `reviewed` date is set to today
- [ ] `review_status` is `resolved` (or `in-progress` if not all findings are fixed)
- [ ] `review_verdict` is `approved-after-review` when all findings are resolved
- [ ] `review_findings_count` matches the number of findings in the review report
- [ ] `review_findings_resolved` equals `review_findings_count` when complete

## 4. Stale File Cleanup
- [ ] Old controller tests that were converted to LiveView tests are marked for deletion
- [ ] Old test files are NOT present in the ATDD checklist anymore
- [ ] A note exists in the review report about stale files to delete

## 5. Pre-Dev Validation
- [ ] `mix compile` is clean (stubs + skipped tests compile)
- [ ] Story status is `ready-for-dev` or `in-progress`
- [ ] No unresolved CRITICAL or HIGH findings remain open

---
If any item fails, do NOT mark the story as ready — fix it first.
