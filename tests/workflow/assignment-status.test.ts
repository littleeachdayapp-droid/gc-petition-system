import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, createTestAssignment, cleanupTestData } from "../helpers/factories";

describe("Assignment Status Transitions", () => {
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

  // --- IN_PROGRESS cascades petition to IN_COMMITTEE ---

  it("PATCH assignment to IN_PROGRESS cascades petition status to IN_COMMITTEE", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "UNDER_REVIEW" });
    const assignment = await createTestAssignment(petition.id);

    const res = await staffFetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(res.status).toBe(200);

    // Verify petition status was updated
    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("IN_COMMITTEE");
  });

  it("PATCH assignment to COMPLETED does NOT cascade petition status", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id);

    const res = await staffFetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    expect(res.status).toBe(200);

    // Petition should still be IN_COMMITTEE (not changed)
    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("IN_COMMITTEE");
  });

  it("PATCH assignment to DEFERRED is accepted", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "UNDER_REVIEW" });
    const assignment = await createTestAssignment(petition.id);

    const res = await staffFetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "DEFERRED" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("DEFERRED");
  });

  it("COMPLETED → PENDING transition is accepted (no state machine enforcement)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id);

    // Move to COMPLETED first
    await staffFetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "COMPLETED" }),
    });

    // Move back to PENDING
    const res = await staffFetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "PENDING" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PENDING");
  });

  it("rejects invalid assignment status", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "UNDER_REVIEW" });
    const assignment = await createTestAssignment(petition.id);

    const res = await staffFetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "INVALID_STATUS" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Status must be one of");
  });

  it("rejects missing status field", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "UNDER_REVIEW" });
    const assignment = await createTestAssignment(petition.id);

    const res = await staffFetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent assignment", async () => {
    const res = await staffFetch("/api/assignments/nonexistent-id", {
      method: "PATCH",
      body: JSON.stringify({ status: "PENDING" }),
    });
    expect(res.status).toBe(404);
  });

  // --- Manual assign edge cases ---

  it("manual assign to committee not matching routing rules succeeds (advisory only)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });
    // Find a committee that likely doesn't match routing rules for this petition
    const committees = await prisma.committee.findMany({ take: 2 });
    const committee = committees[committees.length - 1];

    const res = await staffFetch(`/api/petitions/${petition.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ committeeId: committee.id }),
    });
    expect(res.status).toBe(201);

    // Petition should be UNDER_REVIEW
    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("UNDER_REVIEW");
  });
});
