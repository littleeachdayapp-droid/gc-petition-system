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
├── race-conditions/      # TOCTOU concurrency tests — 7 files, 8 tests
│   ├── double-submit.test.ts
│   ├── committee-actions.test.ts
│   ├── concurrent-amendments.test.ts
│   ├── edit-submit-race.test.ts
│   ├── concurrent-assignments.test.ts
│   ├── plenary-votes.test.ts
│   └── target-replace-submit.test.ts
├── auth/                 # Authorization & role hierarchy — 1 file, 17 tests
│   └── role-access.test.ts
├── workflow/             # Status transitions & business logic — 3 files, 32 tests
│   ├── submission.test.ts
│   ├── committee-flow.test.ts
│   └── plenary-flow.test.ts
├── validation/           # Input validation & sanitization — 1 file, 17 tests
│   └── input-validation.test.ts
├── routing/              # Auto-routing logic (unit tests) — 1 file, 20 tests
│   └── auto-routing.test.ts
├── search/               # Search, filtering, pagination — 1 file, 18 tests
│   └── search-pagination.test.ts
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

### 1. Race Conditions (TOCTOU) — 7 files, 8 tests

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

### 2. Authorization & Role Hierarchy — 1 file, 17 tests

Tests that every endpoint enforces correct role requirements. Role hierarchy: PUBLIC → DELEGATE → COMMITTEE_MEMBER → COMMITTEE_CHAIR → STAFF → ADMIN → SUPER_ADMIN.

| Test | Endpoint | Expected |
|------|----------|----------|
| DELEGATE cannot access admin pipeline | `GET /api/admin/pipeline` | 403 |
| STAFF can access admin pipeline | `GET /api/admin/pipeline` | 200 |
| STAFF cannot access user list (ADMIN required) | `GET /api/admin/users` | 403 |
| ADMIN can access user list | `GET /api/admin/users` | 200 |
| ADMIN cannot assign SUPER_ADMIN role | `PATCH /api/admin/users/[userId]` | 403 |
| ADMIN cannot change their own role | `PATCH /api/admin/users/[userId]` | 400 |
| DELEGATE cannot assign petitions | `POST /api/petitions/[id]/assign` | 403 |
| PUBLIC cannot record committee action | `POST /api/committees/[id]/actions` | 403 |
| Non-member cannot act on committee | `POST /api/committees/[id]/actions` | 403 |
| Non-owner cannot see another's DRAFT | `GET /api/petitions/[id]` | 403 |
| STAFF can view any DRAFT | `GET /api/petitions/[id]` | 200 |
| Non-owner, non-STAFF cannot edit DRAFT | `PATCH /api/petitions/[id]` | 403 |
| STAFF can edit any DRAFT | `PATCH /api/petitions/[id]` | 200 |
| Non-owner, non-ADMIN cannot delete DRAFT | `DELETE /api/petitions/[id]` | 403 |
| Unauthenticated request to protected endpoint | All | 401 |
| DELEGATE cannot update assignment status | `PATCH /api/assignments/[id]` | 403 |
| STAFF cannot delete assignment (ADMIN required) | `DELETE /api/assignments/[id]` | 403 |

### 3. Status Workflow & Transitions — 3 files, 32 tests

Tests every valid and invalid status transition in the petition lifecycle.

**Submission flow (6 tests):**
- Submit DRAFT with valid targets → SUBMITTED + displayNumber + ORIGINAL version
- Submit DRAFT without targets → 400
- Submit non-DRAFT petition → 400
- Submit by non-owner, non-STAFF → 403
- Edit non-DRAFT petition → 400
- Delete non-DRAFT petition → 400

**Committee flow (12 tests):**
- Assign SUBMITTED → UNDER_REVIEW + PENDING assignment
- Reject assigning DRAFT
- Reject duplicate assignment to same committee
- Reject assigning to non-existent committee
- APPROVE → APPROVED_BY_COMMITTEE, assignment COMPLETED
- REJECT → REJECTED_BY_COMMITTEE
- AMEND_AND_APPROVE → AMENDED
- DEFER → IN_COMMITTEE, assignment DEFERRED
- REFER → UNDER_REVIEW
- NO_ACTION → REJECTED_BY_COMMITTEE
- Reject second final action on same assignment
- Assignment IN_PROGRESS → petition IN_COMMITTEE

**Plenary flow (14 tests):**
- Add APPROVED_BY_COMMITTEE to calendar → ON_CALENDAR
- Add AMENDED to calendar
- Add REJECTED_BY_COMMITTEE to calendar (minority report)
- Reject adding DRAFT to calendar
- Reject adding SUBMITTED to calendar
- Reject duplicate petition on same session
- ADOPT vote → ADOPTED
- DEFEAT vote → DEFEATED
- AMEND vote → AMENDED + PLENARY_AMENDED version created
- TABLE vote → stays ON_CALENDAR
- REFER_BACK vote → IN_COMMITTEE
- Reject second final vote on same item
- Remove item with no actions → reverts status
- Reject removing item with recorded votes

### 4. Input Validation & Sanitization — 1 file, 17 tests

- Missing required petition fields (title, actionType, targetBook, conferenceId) — 4 tests
- Non-existent conferenceId → 404
- XSS in title stored safely (no execution)
- SQL injection in search safely parameterized
- Committee action missing action/assignmentId → 400
- Assignment from different committee → 400/404
- Registration missing name/email/password → 400 (3 tests)
- Password < 8 characters → 400
- Duplicate email registration → 409
- Successful registration returns PUBLIC role
- Submit petition without targets → 400

### 5. Auto-Routing Logic (Unit Tests) — 1 file, 20 tests

Pure function tests (no server needed) for `isInRange()`, `routeParagraph()`, `routeResolution()`, `routeByTags()`.

- `isInRange`: inside range, at boundaries (lower/upper), below, above, multiple ranges, empty ranges
- `routeParagraph`: single match, boundary overlap (FA + CB), second range match, no match, committee with no ranges
- `routeResolution`: FA match, CB match, no match
- `routeByTags`: single tag match, multiple committees, no match, empty array, multiple overlapping tags

### 6. Search, Filtering & Pagination — 1 file, 18 tests

- Authenticated: search by title (case-insensitive), filter by status, mine=true, DRAFT visibility, special characters
- Public: excludes DRAFT, pagination metadata, limit clamped to 100, sort by newest/title, status filter, invalid status handled, page 2 skips page 1
- Admin pipeline: returns petitions, filters by search
- Results: adopted filter, defeated filter, summary counts

### 7. Data Integrity & Cascades — 1 file, 8 tests

- Delete DRAFT cascades targets + versions
- 404 for non-existent petition (GET/PATCH/DELETE), committee, assignment
- Referential integrity: assignment → petition + committee, version → petition + creator

### 8. Diff Engine (Unit Tests) — 1 file, 19 tests

Pure function tests (no server needed) for `computeDiff()`, `buildVersionDiffs()`, `compareVersionTargets()`.

- `computeDiff`: word-level diff, empty old (all added), empty new (all removed), both empty, identical texts, multi-word additions, complete replacement
- `buildVersionDiffs`: ADD_PARAGRAPH (all green), DELETE_PARAGRAPH (all red), REPLACE_TEXT (word-level), null proposedText, paragraph/resolution labels, label without title, empty segments for delete with no text
- `compareVersionTargets`: matching targets (old vs new proposed), new target with no old match, resolution targets, null proposedText in both

---

## Summary

| Suite | Files | Tests | Type |
|-------|-------|-------|------|
| Race Conditions | 7 | 8 | Integration |
| Authorization | 1 | 17 | Integration |
| Workflow | 3 | 32 | Integration |
| Validation | 1 | 17 | Integration |
| Routing | 1 | 20 | Unit |
| Search | 1 | 18 | Integration |
| Data Integrity | 1 | 8 | Integration |
| Diff Engine | 1 | 19 | Unit |
| **Total** | **16** | **139** | |
