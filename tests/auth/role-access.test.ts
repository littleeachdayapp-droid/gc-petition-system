import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import { createTestPetition, createTestDelegate, createTestAssignment, cleanupTestData } from "../helpers/factories";

describe("Role-Based Access Control", () => {
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let adminFetch: ReturnType<typeof makeAuthFetch>;
  let publicFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;

  beforeAll(async () => {
    const delegateCookies = await getSessionCookie("delegate@gc2028.org");
    delegateFetch = makeAuthFetch(delegateCookies);
    delegateId = (await prisma.user.findUnique({ where: { email: "delegate@gc2028.org" } }))!.id;

    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const adminCookies = await getSessionCookie("admin@gc2028.org");
    adminFetch = makeAuthFetch(adminCookies);

    const publicCookies = await getSessionCookie("public@gc2028.org");
    publicFetch = makeAuthFetch(publicCookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- Admin Pipeline Access ---

  it("DELEGATE cannot access admin pipeline", async () => {
    const res = await delegateFetch("/api/admin/pipeline");
    expect(res.status).toBe(403);
  });

  it("STAFF can access admin pipeline", async () => {
    const res = await staffFetch("/api/admin/pipeline");
    expect(res.status).toBe(200);
  });

  // --- User Management Access ---

  it("STAFF cannot access user list (ADMIN required)", async () => {
    const res = await staffFetch("/api/admin/users");
    expect(res.status).toBe(403);
  });

  it("ADMIN can access user list", async () => {
    const res = await adminFetch("/api/admin/users");
    expect(res.status).toBe(200);
  });

  it("ADMIN cannot assign SUPER_ADMIN role", async () => {
    const testUser = await createTestDelegate();
    const res = await adminFetch(`/api/admin/users/${testUser.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: "SUPER_ADMIN" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("super admin");
  });

  it("ADMIN cannot change their own role", async () => {
    const adminUser = await prisma.user.findUnique({ where: { email: "admin@gc2028.org" } });
    const res = await adminFetch(`/api/admin/users/${adminUser!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: "STAFF" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("cannot change your own role");
  });

  // --- Petition Assignment Access ---

  it("DELEGATE cannot assign petitions (STAFF required)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });
    const committee = await prisma.committee.findFirst();
    const res = await delegateFetch(`/api/petitions/${petition.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ committeeId: committee!.id }),
    });
    expect(res.status).toBe(403);
  });

  // --- Committee Action Access ---

  it("PUBLIC user cannot record committee action", async () => {
    const committee = await prisma.committee.findFirst();
    const res = await publicFetch(`/api/committees/${committee!.id}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: "fake", action: "APPROVE" }),
    });
    expect(res.status).toBe(403);
  });

  it("non-member cannot act on committee they don't belong to", async () => {
    // Use a COMMITTEE_MEMBER user who is NOT a member of the FA committee
    const nonMemberUser = await createTestDelegate({ role: "COMMITTEE_MEMBER" });
    const nonMemberCookies = await getSessionCookie(nonMemberUser.email);
    const nonMemberFetch = makeAuthFetch(nonMemberCookies);

    const faCommittee = await prisma.committee.findFirst({ where: { abbreviation: "FA" } });
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, faCommittee!.id);

    const res = await nonMemberFetch(`/api/committees/${faCommittee!.id}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "APPROVE", votesFor: 30 }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("not a member");
  });

  // --- DRAFT Visibility ---

  it("non-owner cannot see another user's DRAFT petition", async () => {
    const owner = await createTestDelegate();
    const petition = await createTestPetition({ submitterId: owner.id, status: "DRAFT" });

    const res = await delegateFetch(`/api/petitions/${petition.id}`);
    expect(res.status).toBe(403);
  });

  it("STAFF can view any DRAFT petition", async () => {
    const owner = await createTestDelegate();
    const petition = await createTestPetition({ submitterId: owner.id, status: "DRAFT" });

    const res = await staffFetch(`/api/petitions/${petition.id}`);
    expect(res.status).toBe(200);
  });

  // --- Edit/Delete Ownership ---

  it("non-owner, non-STAFF cannot edit another's DRAFT", async () => {
    const owner = await createTestDelegate();
    const petition = await createTestPetition({ submitterId: owner.id, status: "DRAFT" });

    const res = await delegateFetch(`/api/petitions/${petition.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Hijacked title" }),
    });
    expect(res.status).toBe(403);
  });

  it("STAFF can edit any DRAFT petition", async () => {
    const owner = await createTestDelegate();
    const petition = await createTestPetition({ submitterId: owner.id, status: "DRAFT" });

    const res = await staffFetch(`/api/petitions/${petition.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "__test__Staff edited title" }),
    });
    expect(res.status).toBe(200);
  });

  it("non-owner, non-ADMIN cannot delete another's DRAFT", async () => {
    const owner = await createTestDelegate();
    const petition = await createTestPetition({ submitterId: owner.id, status: "DRAFT" });

    const res = await delegateFetch(`/api/petitions/${petition.id}`, { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  // --- Unauthenticated Access ---

  it("unauthenticated request to protected endpoint returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/petitions`);
    expect(res.status).toBe(401);
  });

  // --- Assignment Management Access ---

  it("DELEGATE cannot update assignment status (STAFF required)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "UNDER_REVIEW" });
    const assignment = await createTestAssignment(petition.id);
    const res = await delegateFetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(res.status).toBe(403);
  });

  it("STAFF cannot delete assignment (ADMIN required)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "UNDER_REVIEW" });
    const assignment = await createTestAssignment(petition.id);
    const res = await staffFetch(`/api/assignments/${assignment.id}`, { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});
