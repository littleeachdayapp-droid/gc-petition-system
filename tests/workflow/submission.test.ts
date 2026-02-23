import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, createTestAssignment, cleanupTestData } from "../helpers/factories";

describe("Petition Submission Workflow", () => {
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

  it("submits DRAFT petition with valid targets → SUBMITTED + displayNumber + ORIGINAL version", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });

    const res = await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("SUBMITTED");
    expect(body.displayNumber).toMatch(/^P-2028-\d{4}$/);

    const version = await prisma.petitionVersion.findFirst({
      where: { petitionId: petition.id },
    });
    expect(version).not.toBeNull();
    expect(version!.stage).toBe("ORIGINAL");
    expect(version!.versionNum).toBe(1);
  });

  it("rejects submit of DRAFT without targets", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, withTarget: false });

    const res = await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("at least one target");
  });

  it("rejects submit of non-DRAFT petition", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });

    const res = await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Only draft petitions");
  });

  it("rejects submit by non-owner, non-STAFF", async () => {
    const otherDelegate = await createTestDelegate();
    const petition = await createTestPetition({ submitterId: otherDelegate.id });

    const res = await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("rejects editing a non-DRAFT petition", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });

    const res = await delegateFetch(`/api/petitions/${petition.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "New title" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Only draft petitions");
  });

  it("rejects deleting a non-DRAFT petition", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });

    const res = await delegateFetch(`/api/petitions/${petition.id}`, { method: "DELETE" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Only draft petitions");
  });
});
