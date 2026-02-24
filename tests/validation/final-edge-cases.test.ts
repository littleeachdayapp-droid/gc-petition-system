import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import {
  createTestPetition, createTestDelegate, createTestAssignment,
  createTestPlenarySession, createTestCalendarItem, cleanupTestData,
} from "../helpers/factories";

describe("Final Edge Cases", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let adminFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;
  let conferenceId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const adminCookies = await getSessionCookie("admin@gc2028.org");
    adminFetch = makeAuthFetch(adminCookies);

    const delegate = await createTestDelegate();
    delegateId = delegate.id;

    const conference = await prisma.conference.findFirst({ where: { isActive: true } });
    conferenceId = conference!.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- 1. Delete plenary session that has calendar items ---

  it("DELETE plenary session with calendar items cascades or errors", async () => {
    const session = await createTestPlenarySession();
    const petition = await createTestPetition({ submitterId: delegateId, status: "APPROVED_BY_COMMITTEE" });
    await createTestCalendarItem(petition.id, session.id);

    const res = await adminFetch(`/api/plenary-sessions/${session.id}`, { method: "DELETE" });
    // Prisma cascade delete or FK error — either 200 (cascade) or 500 (FK constraint)
    expect([200, 500]).toContain(res.status);
  });

  // --- 2. Create session with non-existent conferenceId ---

  it("POST plenary session with non-existent conferenceId returns 500 (FK error)", async () => {
    const res = await staffFetch("/api/plenary-sessions", {
      method: "POST",
      body: JSON.stringify({
        conferenceId: "nonexistent-conference-id",
        sessionNumber: 999,
        date: "2028-05-15",
        timeBlock: "MORNING",
      }),
    });
    expect(res.status).toBe(500);
  });

  // --- 3. Non-numeric sessionNumber on create ---

  it("POST plenary session with non-numeric sessionNumber returns 500 (NaN)", async () => {
    const res = await staffFetch("/api/plenary-sessions", {
      method: "POST",
      body: JSON.stringify({
        conferenceId,
        sessionNumber: "abc",
        date: "2028-05-15",
        timeBlock: "MORNING",
      }),
    });
    // parseInt("abc") → NaN, Prisma rejects NaN for Int field
    expect(res.status).toBe(500);
  });

  // --- 4. Non-numeric orderNumber on calendar item PATCH ---

  it("PATCH calendar item with non-numeric orderNumber returns 500 (NaN)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "APPROVED_BY_COMMITTEE" });
    const session = await createTestPlenarySession();
    const item = await createTestCalendarItem(petition.id, session.id);

    const res = await staffFetch(`/api/plenary-sessions/${session.id}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ orderNumber: "not-a-number" }),
    });
    // parseInt("not-a-number") → NaN, Prisma rejects
    expect(res.status).toBe(500);
  });

  // --- 5. IN_PROGRESS assignment on already-ADOPTED petition ---

  it("IN_PROGRESS assignment on ADOPTED petition overwrites status to IN_COMMITTEE", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ADOPTED" });
    const assignment = await createTestAssignment(petition.id);

    const res = await staffFetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(res.status).toBe(200);

    // The cascade has no guard — it unconditionally sets IN_COMMITTEE
    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("IN_COMMITTEE");
  });

  // --- 6. Invalid membershipId format on DELETE ---

  it("DELETE committee membership with invalid membershipId returns 404", async () => {
    const user = await createTestDelegate();
    const res = await adminFetch(
      `/api/admin/users/${user.id}/committees?membershipId=invalid-uuid-format`,
      { method: "DELETE" }
    );
    // findFirst with invalid ID finds nothing → 404
    expect(res.status).toBe(404);
  });

  // --- 7. Non-numeric resolution number param ---

  it("resolutions with non-numeric number param returns 500 (NaN)", async () => {
    const book = await prisma.book.findFirst();
    const res = await fetch(`${BASE_URL}/api/books/${book!.id}/resolutions?number=xyz`);
    // parseInt("xyz") → NaN, Prisma rejects NaN for Int field
    expect(res.status).toBe(500);
  });
});
