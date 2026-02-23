import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Filter Interaction & Query Edge Cases", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;
  let delegateEmail: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    delegateEmail = delegate.email;
    const delegateCookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(delegateCookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- mine=true + status=DRAFT ---

  it("mine=true with status=DRAFT returns only own drafts", async () => {
    // Create a DRAFT petition owned by our delegate
    await createTestPetition({ submitterId: delegateId, status: "DRAFT" });

    const res = await delegateFetch("/api/petitions?mine=true&status=DRAFT");
    expect(res.status).toBe(200);
    const body = await res.json();

    // All returned petitions should belong to this user
    for (const p of body) {
      expect(p.submitter.id).toBe(delegateId);
    }
  });

  it("non-STAFF user without mine=true cannot see other users' DRAFT petitions in list", async () => {
    // Create another user's DRAFT petition
    const otherUser = await createTestDelegate();
    const otherPetition = await createTestPetition({
      submitterId: otherUser.id,
      status: "DRAFT",
      title: "__test__Other User Draft Invisible",
    });

    const res = await delegateFetch("/api/petitions");
    expect(res.status).toBe(200);
    const body = await res.json();

    // Should NOT contain the other user's DRAFT
    const found = body.find((p: { id: string }) => p.id === otherPetition.id);
    expect(found).toBeUndefined();
  });

  it("STAFF can see all DRAFT petitions", async () => {
    const otherUser = await createTestDelegate();
    await createTestPetition({
      submitterId: otherUser.id,
      status: "DRAFT",
      title: "__test__Staff Visible Draft",
    });

    const res = await staffFetch("/api/petitions?status=DRAFT");
    expect(res.status).toBe(200);
    const body = await res.json();
    // STAFF should see drafts from other users
    expect(body.length).toBeGreaterThan(0);
  });

  // --- conferenceId filter ---

  it("petitions filtered by non-existent conferenceId returns empty array", async () => {
    const res = await delegateFetch("/api/petitions?conferenceId=nonexistent-conf-id");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  // --- Public search multi-status filter ---

  it("public search with comma-separated statuses works", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?status=SUBMITTED,ADOPTED`);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const p of body.petitions) {
      expect(["SUBMITTED", "ADOPTED"]).toContain(p.status);
    }
  });

  it("public search with explicit status=DRAFT overrides base exclusion", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?status=DRAFT,SUBMITTED`);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Note: explicit status filter OVERWRITES the default { not: "DRAFT" } filter.
    // When DRAFT is explicitly requested, it is included in results.
    // All returned petitions should be either DRAFT or SUBMITTED.
    for (const p of body.petitions) {
      expect(["DRAFT", "SUBMITTED"]).toContain(p.status);
    }
  });

  // --- Public search sort modes ---

  it("public search sort=oldest returns ascending order", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?sort=oldest&limit=5`);
    expect(res.status).toBe(200);
    const body = await res.json();
    if (body.petitions.length >= 2) {
      const dates = body.petitions.map((p: { createdAt: string }) => new Date(p.createdAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
      }
    }
  });

  it("public search sort=title returns alphabetical order", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?sort=title&limit=10`);
    expect(res.status).toBe(200);
    const body = await res.json();
    if (body.petitions.length >= 2) {
      for (let i = 1; i < body.petitions.length; i++) {
        expect(body.petitions[i].title.localeCompare(body.petitions[i - 1].title)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("public search sort=number returns display number order", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?sort=number&limit=10`);
    expect(res.status).toBe(200);
    const body = await res.json();
    if (body.petitions.length >= 2) {
      for (let i = 1; i < body.petitions.length; i++) {
        const curr = body.petitions[i].displayNumber || "";
        const prev = body.petitions[i - 1].displayNumber || "";
        expect(curr.localeCompare(prev)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
