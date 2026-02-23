import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Auto-Routing API Integration", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    const delegateCookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(delegateCookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("auto-routes SUBMITTED petition and creates assignments", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });

    const res = await staffFetch(`/api/petitions/${petition.id}/route-petition`, { method: "POST" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.petitionStatus).toBe("UNDER_REVIEW");
    expect(body.assignedTo).toBeDefined();
    expect(Array.isArray(body.assignedTo)).toBe(true);

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("UNDER_REVIEW");
  });

  it("rejects routing non-SUBMITTED petition", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "DRAFT" });
    const res = await staffFetch(`/api/petitions/${petition.id}/route-petition`, { method: "POST" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("SUBMITTED");
  });

  it("rejects routing non-existent petition", async () => {
    const res = await staffFetch("/api/petitions/nonexistent-id/route-petition", { method: "POST" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });

  it("DELEGATE cannot auto-route (STAFF+ required)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });
    const res = await delegateFetch(`/api/petitions/${petition.id}/route-petition`, { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("idempotent routing: second call does not duplicate assignments", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });

    // Route once
    await staffFetch(`/api/petitions/${petition.id}/route-petition`, { method: "POST" });

    // Reset status to SUBMITTED for second route
    await prisma.petition.update({ where: { id: petition.id }, data: { status: "SUBMITTED" } });

    // Route again
    const res = await staffFetch(`/api/petitions/${petition.id}/route-petition`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.newAssignments).toBe(0);
  });
});
