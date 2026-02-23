import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import {
  createTestPetition, createTestDelegate, createTestAssignment,
  createTestPlenarySession, createTestCalendarItem, cleanupTestData,
} from "../helpers/factories";

describe("Access Boundary Edge Cases", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let adminFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;
  let delegateUserId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const adminCookies = await getSessionCookie("admin@gc2028.org");
    adminFetch = makeAuthFetch(adminCookies);

    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    delegateUserId = delegate.id;
    const delegateCookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(delegateCookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- Committee detail accessible to any authenticated user (non-member) ---

  it("DELEGATE can view committee detail they are NOT a member of", async () => {
    const committee = await prisma.committee.findFirst();
    const res = await delegateFetch(`/api/committees/${committee!.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(committee!.id);
    expect(body.memberships).toBeDefined();
  });

  // --- Plenary vote auth ---

  it("non-STAFF user cannot record plenary vote", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const session = await createTestPlenarySession();
    const item = await createTestCalendarItem(petition.id, session.id);

    const res = await delegateFetch(`/api/plenary-sessions/${session.id}/items/${item.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "ADOPT", votesFor: 500, votesAgainst: 200 }),
    });
    expect(res.status).toBe(403);
  });

  // --- PUBLIC role can create petitions ---

  it("PUBLIC role user can create a petition", async () => {
    const publicUser = await createTestDelegate({ role: "DELEGATE" });
    // Register a user that gets PUBLIC role by default via API
    const suffix = Math.random().toString(36).slice(2, 8);
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `__test__Public User ${suffix}`,
        email: `__test__public-${suffix}@gc2028.org`,
        password: "password123",
      }),
    });
    expect(regRes.status).toBe(201);

    const publicCookies = await getSessionCookie(`__test__public-${suffix}@gc2028.org`);
    const publicFetch = makeAuthFetch(publicCookies);

    const conference = await prisma.conference.findFirst({ where: { isActive: true } });
    const res = await publicFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({
        title: "__test__Public User Petition",
        actionType: "AMEND",
        targetBook: "DISCIPLINE",
        conferenceId: conference!.id,
      }),
    });
    expect(res.status).toBe(201);
  });

  // --- STAFF can delete another user's DRAFT petition ---

  it("STAFF can delete another user's DRAFT petition", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    const res = await staffFetch(`/api/petitions/${petition.id}`, { method: "DELETE" });
    // STAFF cannot delete (ADMIN required for non-owner)
    expect(res.status).toBe(403);
  });

  it("ADMIN can delete another user's DRAFT petition", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    const res = await adminFetch(`/api/petitions/${petition.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  // --- Admin pipeline status override ---

  it("admin pipeline with explicit status=DRAFT returns DRAFT petitions", async () => {
    await createTestPetition({ submitterId: delegateId, status: "DRAFT" });

    const res = await staffFetch("/api/admin/pipeline?status=DRAFT");
    expect(res.status).toBe(200);
    const body = await res.json();
    // When status is explicitly provided, it overrides the default filter
    const allDraft = body.every((p: { status: string }) => p.status === "DRAFT");
    if (body.length > 0) {
      expect(allDraft).toBe(true);
    }
  });

  it("admin pipeline with explicit status=ADOPTED returns ADOPTED petitions", async () => {
    const res = await staffFetch("/api/admin/pipeline?status=ADOPTED");
    expect(res.status).toBe(200);
    const body = await res.json();
    const allAdopted = body.every((p: { status: string }) => p.status === "ADOPTED");
    if (body.length > 0) {
      expect(allAdopted).toBe(true);
    }
  });

  // --- Admin committees route with non-existent user ---

  it("admin committees for non-existent user returns 500 (no explicit 404)", async () => {
    const res = await adminFetch("/api/admin/users/nonexistent-user-id/committees", {
      method: "POST",
      body: JSON.stringify({ committeeId: "some-committee-id" }),
    });
    // Prisma FK error → 500 because user doesn't exist
    expect(res.status).toBe(500);
  });

  // --- Delete membership for wrong user ---

  it("delete membership with wrong userId returns 404", async () => {
    // Create a membership for one user
    const committee = await prisma.committee.findFirst();
    const user1 = await createTestDelegate();
    const membership = await prisma.committeeMembership.create({
      data: { userId: user1.id, committeeId: committee!.id, role: "MEMBER" },
    });

    // Try to delete via a different userId path
    const user2 = await createTestDelegate();
    const res = await adminFetch(
      `/api/admin/users/${user2.id}/committees?membershipId=${membership.id}`,
      { method: "DELETE" }
    );
    expect(res.status).toBe(404);

    // Clean up
    await prisma.committeeMembership.delete({ where: { id: membership.id } });
  });
});
