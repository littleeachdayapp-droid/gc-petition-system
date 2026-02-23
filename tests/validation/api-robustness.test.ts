import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import {
  createTestPetition, createTestDelegate, createTestAssignment,
  createTestPlenarySession, createTestCalendarItem, cleanupTestData,
} from "../helpers/factories";

describe("API Robustness & Validation Edge Cases", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;
  let conferenceId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    const delegateCookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(delegateCookies);

    const conference = await prisma.conference.findFirst({ where: { isActive: true } });
    conferenceId = conference!.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- Malformed JSON ---

  it("POST /api/petitions with invalid JSON returns error", async () => {
    const delegate = await createTestDelegate();
    const cookies = await getSessionCookie(delegate.email);

    const res = await fetch(`${BASE_URL}/api/petitions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      body: "not valid json{{{",
    });
    // Should return 400 or 500, not crash the server
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // --- Target with both paragraphId and resolutionId ---

  it("target with both paragraphId and resolutionId is accepted (no rejection)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, withTarget: false });
    const paragraph = await prisma.paragraph.findFirst();
    const resolution = await prisma.resolution.findFirst();

    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({
        targets: [{
          paragraphId: paragraph!.id,
          resolutionId: resolution!.id,
          changeType: "REPLACE_TEXT",
          proposedText: "Test text",
        }],
      }),
    });
    // API accepts this (no validation for "both present")
    expect(res.status).toBe(200);
  });

  // --- Missing calendarType on calendar item ---

  it("POST calendar item with missing calendarType returns 400", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "APPROVED_BY_COMMITTEE" });
    const session = await createTestPlenarySession();

    const res = await staffFetch(`/api/plenary-sessions/${session.id}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("calendarType");
  });

  // --- Missing petitionId on calendar item ---

  it("POST calendar item with missing petitionId returns 400", async () => {
    const session = await createTestPlenarySession();

    const res = await staffFetch(`/api/plenary-sessions/${session.id}/items`, {
      method: "POST",
      body: JSON.stringify({ calendarType: "REGULAR" }),
    });
    expect(res.status).toBe(400);
  });

  // --- Vote counts optional (default to 0) ---

  it("plenary vote with no vote counts defaults to 0", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const session = await createTestPlenarySession();
    const item = await createTestCalendarItem(petition.id, session.id);

    const res = await staffFetch(`/api/plenary-sessions/${session.id}/items/${item.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "ADOPT" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.votesFor).toBe(0);
    expect(body.votesAgainst).toBe(0);
    expect(body.votesAbstain).toBe(0);
  });

  // --- Invalid date on session PATCH ---

  it("PATCH plenary session with invalid date returns 500", async () => {
    const session = await createTestPlenarySession();

    const res = await staffFetch(`/api/plenary-sessions/${session.id}`, {
      method: "PATCH",
      body: JSON.stringify({ date: "not-a-date" }),
    });
    // Prisma will reject Invalid Date → 500
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // --- Non-existent book paragraphs returns empty array ---

  it("paragraphs for non-existent bookId returns empty array", async () => {
    const res = await fetch(`${BASE_URL}/api/books/nonexistent-book-id/paragraphs`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  // --- Public search invalid sort defaults to newest ---

  it("public search with invalid sort parameter defaults gracefully", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?sort=invalid_sort`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.petitions).toBeDefined();
    expect(body.pagination).toBeDefined();
  });

  // --- Amend a petition not in committee-eligible status ---

  it("amend a DRAFT petition is accepted (no status check in amend route)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "DRAFT" });
    const committee = await prisma.committee.findFirst({ where: { abbreviation: { not: "CC" } } });

    const res = await staffFetch(`/api/committees/${committee!.id}/amend`, {
      method: "POST",
      body: JSON.stringify({
        petitionId: petition.id,
        amendedTargets: [{ changeType: "REPLACE_TEXT", proposedText: "Amended" }],
      }),
    });
    // The amend route doesn't check petition status — it creates a version for any status
    expect(res.status).toBe(201);
  });

  // --- Empty amendedTargets ---

  it("amend with empty amendedTargets array is accepted (no validation)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const committee = await prisma.committee.findFirst({ where: { abbreviation: { not: "CC" } } });

    const res = await staffFetch(`/api/committees/${committee!.id}/amend`, {
      method: "POST",
      body: JSON.stringify({
        petitionId: petition.id,
        amendedTargets: [],
      }),
    });
    // Empty array is truthy, so passes the !amendedTargets check
    expect(res.status).toBe(201);
  });

  // --- Session number not updatable via PATCH ---

  it("PATCH plenary session does not update sessionNumber (not in accepted fields)", async () => {
    const session = await createTestPlenarySession();
    const originalNumber = session.sessionNumber;

    const res = await staffFetch(`/api/plenary-sessions/${session.id}`, {
      method: "PATCH",
      body: JSON.stringify({ sessionNumber: 99999 }),
    });
    expect(res.status).toBe(200);

    // sessionNumber should be unchanged
    const updated = await prisma.plenarySession.findUnique({ where: { id: session.id } });
    expect(updated!.sessionNumber).toBe(originalNumber);
  });

  // --- Very long search string ---

  it("authenticated search with very long search string does not crash", async () => {
    const longSearch = "A".repeat(5000);
    const res = await delegateFetch(`/api/petitions?search=${encodeURIComponent(longSearch)}`);
    expect(res.status).toBe(200);
  });

  // --- Conflicting targets on same paragraph ---

  it("same paragraph targeted with different changeTypes is accepted", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, withTarget: false });
    const paragraph = await prisma.paragraph.findFirst();

    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({
        targets: [
          { paragraphId: paragraph!.id, changeType: "REPLACE_TEXT", proposedText: "New text" },
          { paragraphId: paragraph!.id, changeType: "DELETE_TEXT" },
        ],
      }),
    });
    // No validation for conflicting targets on same paragraph — accepted
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(2);
  });

  // --- Large target array ---

  it("petition with 50 targets is accepted", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, withTarget: false });
    const paragraphs = await prisma.paragraph.findMany({ take: 50 });

    const targets = paragraphs.map((p) => ({
      paragraphId: p.id,
      changeType: "REPLACE_TEXT",
      proposedText: "Proposed amendment text",
    }));

    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({ targets }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(targets.length);
  });
});
