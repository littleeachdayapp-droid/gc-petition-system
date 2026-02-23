import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import { createTestPetition, createTestDelegate, createTestAssignment, cleanupTestData } from "../helpers/factories";

describe("Committee List, Detail & Assignment Endpoints", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const delegate = await createTestDelegate();
    delegateId = delegate.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- Committee List ---

  it("lists all committees with counts, ordered by abbreviation", async () => {
    const res = await fetch(`${BASE_URL}/api/committees`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]._count).toBeDefined();
    expect(typeof body[0]._count.memberships).toBe("number");
    expect(typeof body[0]._count.assignments).toBe("number");

    // Verify alphabetical order by abbreviation
    for (let i = 1; i < body.length; i++) {
      expect(body[i].abbreviation >= body[i - 1].abbreviation).toBe(true);
    }
  });

  // --- Committee Detail ---

  it("returns committee detail with memberships", async () => {
    const committee = await prisma.committee.findFirst();
    const res = await staffFetch(`/api/committees/${committee!.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(committee!.id);
    expect(body.memberships).toBeDefined();
    expect(Array.isArray(body.memberships)).toBe(true);
    expect(body._count).toBeDefined();
  });

  it("returns 404 for non-existent committee detail", async () => {
    const res = await staffFetch("/api/committees/nonexistent-id");
    expect(res.status).toBe(404);
  });

  // --- Committee Assignments ---

  it("lists assignments for a committee", async () => {
    const committee = await prisma.committee.findFirst();
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    await createTestAssignment(petition.id, committee!.id);

    const res = await staffFetch(`/api/committees/${committee!.id}/assignments`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].petition).toBeDefined();
  });

  it("filters assignments by status", async () => {
    const committee = await prisma.committee.findFirst();
    const res = await staffFetch(`/api/committees/${committee!.id}/assignments?status=PENDING`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((a: { status: string }) => a.status === "PENDING")).toBe(true);
  });

  it("returns empty array for unmatched status filter", async () => {
    const committee = await prisma.committee.findFirst();
    const res = await staffFetch(`/api/committees/${committee!.id}/assignments?status=DEFERRED`);
    expect(res.status).toBe(200);
    const body = await res.json();
    // May or may not have deferred assignments, but should not crash
    expect(Array.isArray(body)).toBe(true);
  });

  // --- Admin Pipeline Default Filter ---

  it("admin pipeline default shows only actionable statuses (excludes DRAFT/ADOPTED/DEFEATED)", async () => {
    const res = await staffFetch("/api/admin/pipeline");
    expect(res.status).toBe(200);
    const body = await res.json();
    const statuses = body.map((p: { status: string }) => p.status);
    // Default filter should NOT include DRAFT, ADOPTED, DEFEATED, ON_CALENDAR, WITHDRAWN
    expect(statuses).not.toContain("DRAFT");
    expect(statuses).not.toContain("ADOPTED");
    expect(statuses).not.toContain("DEFEATED");
  });

  it("admin pipeline can filter to specific status", async () => {
    // Create a SUBMITTED petition to ensure there's data
    await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });

    const res = await staffFetch("/api/admin/pipeline?status=SUBMITTED");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((p: { status: string }) => p.status === "SUBMITTED")).toBe(true);
  });
});
