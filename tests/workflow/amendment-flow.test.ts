import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, createTestAssignment, cleanupTestData } from "../helpers/factories";

describe("Committee Amendment Workflow", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;
  let committeeId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const delegate = await createTestDelegate();
    delegateId = delegate.id;

    const committee = await prisma.committee.findFirst({ where: { abbreviation: { not: "CC" } } });
    committeeId = committee!.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("creates COMMITTEE_AMENDED version and updates status to AMENDED", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    // Create original version first
    const staffUser = await prisma.user.findFirst({ where: { role: "STAFF" } });
    await prisma.petitionVersion.create({
      data: { petitionId: petition.id, versionNum: 1, stage: "ORIGINAL", snapshotJson: {}, createdById: staffUser!.id },
    });

    const res = await staffFetch(`/api/committees/${committeeId}/amend`, {
      method: "POST",
      body: JSON.stringify({
        petitionId: petition.id,
        amendedTargets: [{ changeType: "REPLACE_TEXT", proposedText: "Amended text" }],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.stage).toBe("COMMITTEE_AMENDED");
    expect(body.versionNum).toBe(2);

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("AMENDED");
  });

  it("rejects amendment with missing petitionId", async () => {
    const res = await staffFetch(`/api/committees/${committeeId}/amend`, {
      method: "POST",
      body: JSON.stringify({ amendedTargets: [{ changeType: "REPLACE_TEXT" }] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("rejects amendment with missing amendedTargets", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const res = await staffFetch(`/api/committees/${committeeId}/amend`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects amendment for non-existent petition", async () => {
    const res = await staffFetch(`/api/committees/${committeeId}/amend`, {
      method: "POST",
      body: JSON.stringify({
        petitionId: "nonexistent-id",
        amendedTargets: [{ changeType: "REPLACE_TEXT" }],
      }),
    });
    expect(res.status).toBe(404);
  });

  it("non-member COMMITTEE_MEMBER cannot amend", async () => {
    const nonMember = await createTestDelegate({ role: "COMMITTEE_MEMBER" });
    const nonMemberCookies = await getSessionCookie(nonMember.email);
    const nonMemberFetch = makeAuthFetch(nonMemberCookies);

    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });

    const res = await nonMemberFetch(`/api/committees/${committeeId}/amend`, {
      method: "POST",
      body: JSON.stringify({
        petitionId: petition.id,
        amendedTargets: [{ changeType: "REPLACE_TEXT", proposedText: "Amended" }],
      }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("not a member");
  });
});
