import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Petition Targets Validation", () => {
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

  it("replaces targets on DRAFT petition", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    const paragraph = await prisma.paragraph.findFirst();

    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({
        targets: [{
          paragraphId: paragraph!.id,
          changeType: "REPLACE_TEXT",
          proposedText: "New proposed text",
        }],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].changeType).toBe("REPLACE_TEXT");
  });

  it("rejects empty targets array", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({ targets: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("least one target");
  });

  it("rejects target missing changeType", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    const paragraph = await prisma.paragraph.findFirst();

    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({
        targets: [{ paragraphId: paragraph!.id }],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("changeType");
  });

  it("rejects target missing both paragraphId and resolutionId", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({
        targets: [{ changeType: "REPLACE_TEXT", proposedText: "Something" }],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("paragraph or resolution");
  });

  it("rejects targets on non-DRAFT petition", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });
    const paragraph = await prisma.paragraph.findFirst();

    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({
        targets: [{ paragraphId: paragraph!.id, changeType: "REPLACE_TEXT" }],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("draft");
  });

  it("rejects targets on non-existent petition", async () => {
    const res = await delegateFetch("/api/petitions/nonexistent-id/targets", {
      method: "POST",
      body: JSON.stringify({
        targets: [{ paragraphId: "fake", changeType: "REPLACE_TEXT" }],
      }),
    });
    expect(res.status).toBe(404);
  });

  it("non-owner cannot replace targets on another's DRAFT", async () => {
    const otherDelegate = await createTestDelegate();
    const petition = await createTestPetition({ submitterId: otherDelegate.id });
    const paragraph = await prisma.paragraph.findFirst();

    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({
        targets: [{ paragraphId: paragraph!.id, changeType: "REPLACE_TEXT" }],
      }),
    });
    expect(res.status).toBe(403);
  });
});
