import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, createTestAssignment, cleanupTestData } from "../helpers/factories";

describe("Data Integrity & Cascades", () => {
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;

  beforeAll(async () => {
    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    const cookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(cookies);

    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- Cascade Deletes ---

  it("deleting DRAFT petition cascades targets and versions", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "DRAFT" });

    // Verify target exists
    const targetsBefore = await prisma.petitionTarget.count({ where: { petitionId: petition.id } });
    expect(targetsBefore).toBeGreaterThan(0);

    const res = await delegateFetch(`/api/petitions/${petition.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);

    // Verify cascade: petition, targets, versions all gone
    const petitionAfter = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(petitionAfter).toBeNull();

    const targetsAfter = await prisma.petitionTarget.count({ where: { petitionId: petition.id } });
    expect(targetsAfter).toBe(0);

    const versionsAfter = await prisma.petitionVersion.count({ where: { petitionId: petition.id } });
    expect(versionsAfter).toBe(0);
  });

  // --- 404 Handling ---

  it("GET non-existent petition returns 404", async () => {
    const res = await staffFetch("/api/petitions/nonexistent-id-12345");
    expect(res.status).toBe(404);
  });

  it("PATCH non-existent petition returns 404", async () => {
    const res = await staffFetch("/api/petitions/nonexistent-id-12345", {
      method: "PATCH",
      body: JSON.stringify({ title: "New title" }),
    });
    expect(res.status).toBe(404);
  });

  it("DELETE non-existent petition returns 404", async () => {
    const res = await staffFetch("/api/petitions/nonexistent-id-12345", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("GET non-existent committee returns 404", async () => {
    const res = await staffFetch("/api/committees/nonexistent-id-12345");
    expect(res.status).toBe(404);
  });

  it("PATCH non-existent assignment returns 404", async () => {
    const res = await staffFetch("/api/assignments/nonexistent-id-12345", {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(res.status).toBe(404);
  });

  // --- Referential Integrity ---

  it("assignment references valid petition and committee", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "UNDER_REVIEW" });
    const committee = await prisma.committee.findFirst();
    const assignment = await createTestAssignment(petition.id, committee!.id);

    const loaded = await prisma.petitionAssignment.findUnique({
      where: { id: assignment.id },
      include: { petition: true, committee: true },
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.petition.id).toBe(petition.id);
    expect(loaded!.committee.id).toBe(committee!.id);
  });

  it("petition version references valid petition and creator", async () => {
    // Submit a petition to create an ORIGINAL version
    const petition = await createTestPetition({ submitterId: delegateId });
    const res = await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });
    expect(res.status).toBe(200);

    const version = await prisma.petitionVersion.findFirst({
      where: { petitionId: petition.id },
      include: { petition: true, createdBy: true },
    });
    expect(version).not.toBeNull();
    expect(version!.petition.id).toBe(petition.id);
    expect(version!.createdBy).not.toBeNull();
  });
});
