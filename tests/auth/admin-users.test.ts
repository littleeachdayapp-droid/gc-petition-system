import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Admin User & Committee Membership Management", () => {
  let adminFetch: ReturnType<typeof makeAuthFetch>;
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateFetch: ReturnType<typeof makeAuthFetch>;

  beforeAll(async () => {
    const adminCookies = await getSessionCookie("admin@gc2028.org");
    adminFetch = makeAuthFetch(adminCookies);

    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const delegate = await createTestDelegate({ role: "DELEGATE" });
    const delegateCookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(delegateCookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- User List ---

  it("ADMIN can list all users with memberships", async () => {
    const res = await adminFetch("/api/admin/users");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    // Should include membership info
    expect(body[0]).toHaveProperty("committeeMemberships");
  });

  it("STAFF cannot list users (ADMIN required)", async () => {
    const res = await staffFetch("/api/admin/users");
    expect(res.status).toBe(403);
  });

  it("DELEGATE cannot list users", async () => {
    const res = await delegateFetch("/api/admin/users");
    expect(res.status).toBe(403);
  });

  // --- Role Updates ---

  it("ADMIN can change user role", async () => {
    const testUser = await createTestDelegate();
    const res = await adminFetch(`/api/admin/users/${testUser.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: "STAFF" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("STAFF");
  });

  it("ADMIN can update delegationConference", async () => {
    const testUser = await createTestDelegate();
    const res = await adminFetch(`/api/admin/users/${testUser.id}`, {
      method: "PATCH",
      body: JSON.stringify({ delegationConference: "North Texas" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.delegationConference).toBe("North Texas");
  });

  it("rejects invalid role value", async () => {
    const testUser = await createTestDelegate();
    const res = await adminFetch(`/api/admin/users/${testUser.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: "INVALID_ROLE" }),
    });
    expect(res.status).toBe(400);
  });

  // --- Committee Membership CRUD ---

  it("ADMIN can add user to committee", async () => {
    const testUser = await createTestDelegate();
    const committee = await prisma.committee.findFirst();

    const res = await adminFetch(`/api/admin/users/${testUser.id}/committees`, {
      method: "POST",
      body: JSON.stringify({ committeeId: committee!.id, role: "MEMBER" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.committee.id).toBe(committee!.id);
  });

  it("rejects duplicate committee membership", async () => {
    const testUser = await createTestDelegate();
    const committee = await prisma.committee.findFirst();

    // Add first time
    await adminFetch(`/api/admin/users/${testUser.id}/committees`, {
      method: "POST",
      body: JSON.stringify({ committeeId: committee!.id }),
    });

    // Add second time
    const res = await adminFetch(`/api/admin/users/${testUser.id}/committees`, {
      method: "POST",
      body: JSON.stringify({ committeeId: committee!.id }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already a member");
  });

  it("rejects adding membership without committeeId", async () => {
    const testUser = await createTestDelegate();
    const res = await adminFetch(`/api/admin/users/${testUser.id}/committees`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("ADMIN can remove committee membership", async () => {
    const testUser = await createTestDelegate();
    const committee = await prisma.committee.findFirst();

    // Add membership
    const addRes = await adminFetch(`/api/admin/users/${testUser.id}/committees`, {
      method: "POST",
      body: JSON.stringify({ committeeId: committee!.id }),
    });
    const membership = await addRes.json();

    // Remove it
    const res = await adminFetch(`/api/admin/users/${testUser.id}/committees?membershipId=${membership.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
  });

  it("rejects removing membership without membershipId", async () => {
    const testUser = await createTestDelegate();
    const res = await adminFetch(`/api/admin/users/${testUser.id}/committees`, {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent membership", async () => {
    const testUser = await createTestDelegate();
    const res = await adminFetch(`/api/admin/users/${testUser.id}/committees?membershipId=nonexistent-id`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("STAFF cannot manage committee memberships", async () => {
    const testUser = await createTestDelegate();
    const committee = await prisma.committee.findFirst();
    const res = await staffFetch(`/api/admin/users/${testUser.id}/committees`, {
      method: "POST",
      body: JSON.stringify({ committeeId: committee!.id }),
    });
    expect(res.status).toBe(403);
  });
});
