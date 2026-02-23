# GC Petition System — Test Suite

## Overview

Integration tests run against a live dev server (`pnpm dev`) and real PostgreSQL database. Tests authenticate via NextAuth's CSRF + credentials flow and make real HTTP requests, then verify **database state** (not just HTTP responses) to catch subtle bugs. Unit tests (routing, diff) run without a server.

## Running Tests

```bash
# Prerequisites: Docker DB running + dev server running
docker start gc-petition-db
pnpm dev &

# Run all tests
pnpm test

# Watch mode
pnpm test:watch
```

## Architecture

```
tests/
├── helpers/
│   ├── setup.ts          # BASE_URL, getSessionCookie(), makeAuthFetch(), Prisma client
│   └── factories.ts      # createTestPetition(), createTestDelegate(), cleanup helpers
├── race-conditions/      # TOCTOU concurrency tests — 8 files, 9 tests
│   ├── double-submit.test.ts
│   ├── committee-actions.test.ts
│   ├── concurrent-amendments.test.ts
│   ├── edit-submit-race.test.ts
│   ├── concurrent-assignments.test.ts
│   ├── plenary-votes.test.ts
│   ├── target-replace-submit.test.ts
│   └── display-number-stress.test.ts
├── auth/                 # Authorization & role hierarchy — 4 files, 44 tests
│   ├── role-access.test.ts
│   ├── admin-users.test.ts
│   ├── session-security.test.ts
│   └── access-boundaries.test.ts
├── workflow/             # Status transitions & business logic — 11 files, 90 tests
│   ├── submission.test.ts
│   ├── committee-flow.test.ts
│   ├── amendment-flow.test.ts
│   ├── plenary-flow.test.ts
│   ├── plenary-session-crud.test.ts
│   ├── calendar-item-update.test.ts
│   ├── auto-routing.test.ts
│   ├── full-lifecycle.test.ts
│   ├── calendar-re-add.test.ts
│   └── assignment-status.test.ts
├── validation/           # Input validation & sanitization — 4 files, 49 tests
│   ├── input-validation.test.ts
│   ├── targets-validation.test.ts
│   ├── edge-cases.test.ts
│   └── api-robustness.test.ts
├── routing/              # Auto-routing logic (unit tests) — 1 file, 20 tests
│   └── auto-routing.test.ts
├── search/               # Search, filtering, pagination, APIs — 7 files, 54 tests
│   ├── search-pagination.test.ts
│   ├── documents.test.ts
│   ├── public-detail.test.ts
│   ├── version-diff-api.test.ts
│   ├── endpoints-misc.test.ts
│   ├── committee-endpoints.test.ts
│   └── filter-interactions.test.ts
├── integrity/            # Data integrity & cascades — 1 file, 8 tests
│   └── data-integrity.test.ts
├── diff/                 # Diff engine (unit tests) — 1 file, 19 tests
│   └── diff-engine.test.ts
└── README.md
```

### Test Helpers

- **`getSessionCookie(email, password)`** — Full NextAuth CSRF + credentials sign-in, returns cookie string
- **`makeAuthFetch(cookies)`** — `fetch` wrapper with auth cookies + JSON content type
- **`prisma`** — Direct Prisma client for verifying database state after API calls
- **Factories** — `createTestPetition()`, `createTestDelegate()`, `createTestAssignment()`, `createTestPlenarySession()`, `createTestCalendarItem()`
- **`cleanupTestData()`** — Deletes test data in FK-safe order

---

## Test Suites

### 1. Race Conditions (TOCTOU) — 8 files, 9 tests

Every mutation API route had time-of-check-time-of-use vulnerabilities where status checks happened in separate queries before transactions. All fixed with interactive `$transaction` and `SELECT ... FOR UPDATE` row locks.

| Test | Scenario | Fix Applied |
|------|----------|-------------|
| `double-submit` | Two petitions submitted concurrently → display number collision; same petition submitted twice | Interactive `$transaction` for count + status check |
| `committee-actions` | Two concurrent APPROVE/REJECT on same assignment → duplicate actions | `SELECT ... FOR UPDATE` row lock on assignment |
| `concurrent-amendments` | Two amendments concurrently → version number collision | Interactive `$transaction` for version number computation |
| `edit-submit-race` | PATCH edit + POST submit concurrently → edit after submit | Interactive `$transaction` re-checks DRAFT status |
| `concurrent-assignments` | Two assign requests to same committee → duplicate | `$transaction` + P2002 unique constraint handling |
| `plenary-votes` | Two concurrent ADOPT/DEFEAT votes → duplicate actions | `SELECT ... FOR UPDATE` row lock on calendar item |
| `target-replace-submit` | Replace targets + submit concurrently → stale snapshot | Interactive `$transaction` re-checks DRAFT status |
| `display-number-stress` | 5 concurrent submits of different petitions → unique display numbers | Serializable isolation prevents duplicates; some transactions retry-fail (expected) |

### 2. Authorization & Role Hierarchy — 4 files, 44 tests

**role-access.test.ts (17 tests):**
- Admin pipeline access (DELEGATE→403, STAFF→200)
- User list access (STAFF→403, ADMIN→200)
- Role escalation prevention (ADMIN cannot assign SUPER_ADMIN, cannot change own role)
- Committee membership enforcement (non-member→403)
- DRAFT visibility (non-owner→403, STAFF→200)
- Edit/delete ownership (non-owner→403, STAFF can edit, ADMIN required to delete others')
- Unauthenticated→401, assignment management access

**admin-users.test.ts (13 tests):**
- User list with memberships (ADMIN→200, STAFF→403, DELEGATE→403)
- Role updates (change role, update delegationConference, invalid role→400)
- Committee membership CRUD (add→201, duplicate→409, missing committeeId→400, remove→200, missing membershipId→400, non-existent→404, STAFF→403)

**session-security.test.ts (5 tests):**
- Invalid session cookie→401, no cookies→401
- Role demotion enforced on re-login (STAFF→DELEGATE blocks admin access)
- Protected API routes all require auth
- Public API routes accessible without auth

**access-boundaries.test.ts (9 tests):**
- Non-member DELEGATE can view committee detail (public within auth)
- Non-STAFF cannot record plenary votes
- PUBLIC role user can create petitions
- STAFF cannot delete others' petitions (ADMIN required), ADMIN can
- Admin pipeline explicit status override (DRAFT, ADOPTED)
- Admin committees route with non-existent user→500
- Delete membership with wrong userId→404

### 3. Status Workflow & Transitions — 11 files, 90 tests

**submission.test.ts (6 tests):** Submit DRAFT, reject without targets, reject non-DRAFT, reject non-owner, reject editing/deleting non-DRAFT

**committee-flow.test.ts (12 tests):** Assignment flow (SUBMITTED→UNDER_REVIEW, reject DRAFT, reject duplicate, reject non-existent), all 6 committee actions (APPROVE→APPROVED_BY_COMMITTEE, REJECT, AMEND_AND_APPROVE, DEFER, REFER, NO_ACTION), reject second action, IN_PROGRESS→IN_COMMITTEE

**amendment-flow.test.ts (5 tests):** Create COMMITTEE_AMENDED version→AMENDED, reject missing petitionId, reject missing amendedTargets, reject non-existent petition, non-member→403

**plenary-flow.test.ts (14 tests):** Calendar placement (3 valid statuses + reject DRAFT/SUBMITTED + reject duplicate), all vote types (ADOPT, DEFEAT, AMEND+version, TABLE, REFER_BACK), reject second vote, remove item with/without actions

**plenary-session-crud.test.ts (13 tests):** Create (STAFF→201, missing fields→400, invalid timeBlock→400, DELEGATE→403), list + filter by conferenceId, detail + 404, update (STAFF→200, DELEGATE→403), delete (ADMIN→200, STAFF→403, DELEGATE→403)

**calendar-item-update.test.ts (5 tests):** Update calendarType→200, update orderNumber, invalid calendarType→400, wrong session→404, DELEGATE→403

**auto-routing.test.ts (5 tests):** Route SUBMITTED→UNDER_REVIEW with assignments, reject non-SUBMITTED→400, reject non-existent→400, DELEGATE→403, idempotent routing (no duplicates)

**full-lifecycle.test.ts (2 tests):** Complete adopt path (DRAFT→SUBMITTED→UNDER_REVIEW→IN_COMMITTEE→APPROVED_BY_COMMITTEE→ON_CALENDAR→ADOPTED) and defeat path (through REJECTED_BY_COMMITTEE→SPECIAL_ORDER→DEFEATED)

**calendar-re-add.test.ts (3 tests):** Remove from calendar then re-add, amendment version sequencing (v1→v2→v3), calendar item ordering preserved

**assignment-status.test.ts (8 tests):** IN_PROGRESS cascades petition to IN_COMMITTEE, COMPLETED does NOT cascade, DEFERRED accepted, COMPLETED→PENDING accepted (no state machine), invalid status→400, missing status→400, non-existent→404, manual assign to non-matching committee (advisory routing)

### 4. Input Validation & Sanitization — 4 files, 49 tests

**input-validation.test.ts (17 tests):** Missing petition fields (title, actionType, targetBook, conferenceId), non-existent conferenceId→404, XSS stored safely, SQL injection parameterized, committee action missing action/assignmentId, assignment from wrong committee, registration (missing name/email/password→400, short password→400, duplicate email→409, success→PUBLIC role), submit without targets→400

**targets-validation.test.ts (7 tests):** Replace targets on DRAFT→200, empty array→400, missing changeType→400, missing paragraphId+resolutionId→400, non-DRAFT→400, non-existent petition→404, non-owner→403

**edge-cases.test.ts (11 tests):** Unicode/emoji in titles, 10K char proposedText, invalid actionType/targetBook enums, pagination edge cases (page beyond total, limit 0, negative page), empty string title→400, zero vote counts accepted, display number immutability after submission, display number zero-padded format (P-YYYY-NNNN)

**api-robustness.test.ts (14 tests):** Malformed JSON→error, target with both paragraphId+resolutionId accepted, missing calendarType/petitionId→400, plenary vote defaults (0 votes), invalid date on session PATCH, non-existent book→empty array, invalid sort→default, amend DRAFT petition (no status check), empty amendedTargets accepted, session number immutable via PATCH, long search string, conflicting targets on same paragraph, 50 targets accepted

### 5. Auto-Routing Logic (Unit Tests) — 1 file, 20 tests

Pure function tests for `isInRange()`, `routeParagraph()`, `routeResolution()`, `routeByTags()` with boundary values, multiple ranges, empty inputs.

### 6. Search, Filtering, Pagination & APIs — 7 files, 54 tests

**search-pagination.test.ts (18 tests):** Auth search by title, status filter, mine=true, DRAFT visibility, special characters; public search excludes DRAFT, pagination metadata, limit clamp, sort by newest/title, status filter, invalid status, page 2 no overlap; admin pipeline + search; results adopted/defeated/summary

**documents.test.ts (8 tests):** List books with counts, paragraphs by book/search/number/sectionId, resolutions by book/search/topicGroup

**public-detail.test.ts (3 tests):** SUBMITTED petition with nested data, DRAFT→404, non-existent→404

**version-diff-api.test.ts (6 tests):** Version diffs with targets, DRAFT→404, non-existent→404, wrong petition→404, compareWith two versions, invalid compareWith→404

**endpoints-misc.test.ts (4 tests):** Health endpoint (ok + counts), dashboard stats (auth→200, unauth→401), conferences list ordered by year

**committee-endpoints.test.ts (8 tests):** Committee list with counts + alphabetical ordering, committee detail with memberships, 404 for non-existent, assignment listing + status filter, admin pipeline default excludes DRAFT/ADOPTED/DEFEATED, pipeline specific status filter

**filter-interactions.test.ts (9 tests):** mine=true + DRAFT returns only own drafts, non-STAFF can't see others' DRAFTs, STAFF sees all DRAFTs, non-existent conferenceId→empty, comma-separated status filter, explicit DRAFT in status overrides base exclusion, sort=oldest/title/number ordering

### 7. Data Integrity & Cascades — 1 file, 8 tests

Delete DRAFT cascades targets+versions, 404 for non-existent petition/committee/assignment, referential integrity checks

### 8. Diff Engine (Unit Tests) — 1 file, 19 tests

Pure function tests for `computeDiff()`, `buildVersionDiffs()`, `compareVersionTargets()` covering word-level diff, empty inputs, change types, labels, null handling

---

## Summary

| Suite | Files | Tests | Type |
|-------|-------|-------|------|
| Race Conditions | 8 | 9 | Integration |
| Authorization | 4 | 44 | Integration |
| Workflow | 11 | 90 | Integration |
| Validation | 4 | 49 | Integration |
| Routing | 1 | 20 | Unit |
| Search & APIs | 7 | 54 | Integration |
| Data Integrity | 1 | 8 | Integration |
| Diff Engine | 1 | 19 | Unit |
| **Total** | **36** | **278** | |
