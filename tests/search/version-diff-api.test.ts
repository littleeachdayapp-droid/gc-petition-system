import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Version Diff API", () => {
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;

  beforeAll(async () => {
    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    const cookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(cookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("returns diffs for a version with targets", async () => {
    // Create petition, submit it to get ORIGINAL version
    const petition = await createTestPetition({ submitterId: delegateId });
    const submitRes = await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });
    expect(submitRes.status).toBe(200);

    const version = await prisma.petitionVersion.findFirst({
      where: { petitionId: petition.id, stage: "ORIGINAL" },
    });
    expect(version).not.toBeNull();

    // Version diff API is public for non-DRAFT petitions
    const res = await fetch(`${BASE_URL}/api/petitions/${petition.id}/versions/${version!.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBeDefined();
    expect(body.version.stage).toBe("ORIGINAL");
    expect(body.diffs).toBeDefined();
    expect(Array.isArray(body.diffs)).toBe(true);
  });

  it("returns 404 for DRAFT petition version", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "DRAFT" });
    const res = await fetch(`${BASE_URL}/api/petitions/${petition.id}/versions/fake-version-id`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent petition", async () => {
    const res = await fetch(`${BASE_URL}/api/petitions/nonexistent-id/versions/fake-version-id`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for version belonging to different petition", async () => {
    // Create two petitions and submit both
    const petition1 = await createTestPetition({ submitterId: delegateId });
    await delegateFetch(`/api/petitions/${petition1.id}/submit`, { method: "POST" });
    const petition2 = await createTestPetition({ submitterId: delegateId });
    await delegateFetch(`/api/petitions/${petition2.id}/submit`, { method: "POST" });

    const version1 = await prisma.petitionVersion.findFirst({ where: { petitionId: petition1.id } });

    // Try to access petition1's version through petition2's URL
    const res = await fetch(`${BASE_URL}/api/petitions/${petition2.id}/versions/${version1!.id}`);
    expect(res.status).toBe(404);
  });

  it("compares two versions with ?compareWith", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });

    // Create a second version manually
    const staffUser = await prisma.user.findFirst({ where: { role: "STAFF" } });
    const v1 = await prisma.petitionVersion.findFirst({ where: { petitionId: petition.id } });
    const v2 = await prisma.petitionVersion.create({
      data: {
        petitionId: petition.id,
        versionNum: 2,
        stage: "COMMITTEE_AMENDED",
        snapshotJson: v1!.snapshotJson || {},
        createdById: staffUser!.id,
      },
    });

    const res = await fetch(`${BASE_URL}/api/petitions/${petition.id}/versions/${v2.id}?compareWith=${v1!.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version.id).toBe(v2.id);
    expect(body.compareWith.id).toBe(v1!.id);
    expect(body.diffs).toBeDefined();
  });

  it("returns 404 for invalid compareWith version", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });
    const version = await prisma.petitionVersion.findFirst({ where: { petitionId: petition.id } });

    const res = await fetch(`${BASE_URL}/api/petitions/${petition.id}/versions/${version!.id}?compareWith=nonexistent`);
    expect(res.status).toBe(404);
  });
});
