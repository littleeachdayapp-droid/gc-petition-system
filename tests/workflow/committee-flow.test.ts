import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, createTestAssignment, cleanupTestData } from "../helpers/factories";

describe("Committee Action Workflow", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let committeeId: string;
  let delegateId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const committee = await prisma.committee.findFirst({ where: { abbreviation: { not: "CC" } } });
    committeeId = committee!.id;

    const delegate = await createTestDelegate();
    delegateId = delegate.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- Assignment Flow ---

  it("assigns SUBMITTED petition → UNDER_REVIEW + PENDING assignment", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });
    const res = await staffFetch(`/api/petitions/${petition.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ committeeId }),
    });
    expect(res.status).toBe(201);

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("UNDER_REVIEW");

    const assignment = await prisma.petitionAssignment.findFirst({ where: { petitionId: petition.id } });
    expect(assignment!.status).toBe("PENDING");
  });

  it("rejects assigning DRAFT petition", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "DRAFT" });
    const res = await staffFetch(`/api/petitions/${petition.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ committeeId }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate assignment to same committee", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });
    await createTestAssignment(petition.id, committeeId);
    // Update status to allow second assign attempt
    await prisma.petition.update({ where: { id: petition.id }, data: { status: "UNDER_REVIEW" } });

    const res = await staffFetch(`/api/petitions/${petition.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ committeeId }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects assigning to non-existent committee", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });
    const res = await staffFetch(`/api/petitions/${petition.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ committeeId: "nonexistent-id" }),
    });
    expect(res.status).toBe(404);
  });

  // --- Committee Action Status Mapping ---

  it("APPROVE → APPROVED_BY_COMMITTEE, assignment COMPLETED", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, committeeId);

    const res = await staffFetch(`/api/committees/${committeeId}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "APPROVE", votesFor: 30, votesAgainst: 5 }),
    });
    expect(res.status).toBe(201);

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("APPROVED_BY_COMMITTEE");

    const updatedAssignment = await prisma.petitionAssignment.findUnique({ where: { id: assignment.id } });
    expect(updatedAssignment!.status).toBe("COMPLETED");
  });

  it("REJECT → REJECTED_BY_COMMITTEE", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, committeeId);

    await staffFetch(`/api/committees/${committeeId}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "REJECT", votesFor: 5, votesAgainst: 30 }),
    });

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("REJECTED_BY_COMMITTEE");
  });

  it("AMEND_AND_APPROVE → AMENDED", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, committeeId);

    await staffFetch(`/api/committees/${committeeId}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "AMEND_AND_APPROVE", votesFor: 25, votesAgainst: 10 }),
    });

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("AMENDED");
  });

  it("DEFER → IN_COMMITTEE, assignment DEFERRED", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, committeeId);

    await staffFetch(`/api/committees/${committeeId}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "DEFER" }),
    });

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("IN_COMMITTEE");

    const updatedAssignment = await prisma.petitionAssignment.findUnique({ where: { id: assignment.id } });
    expect(updatedAssignment!.status).toBe("DEFERRED");
  });

  it("REFER → UNDER_REVIEW", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, committeeId);

    await staffFetch(`/api/committees/${committeeId}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "REFER" }),
    });

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("UNDER_REVIEW");
  });

  it("NO_ACTION → REJECTED_BY_COMMITTEE", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, committeeId);

    await staffFetch(`/api/committees/${committeeId}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "NO_ACTION" }),
    });

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("REJECTED_BY_COMMITTEE");
  });

  it("rejects second final action on same assignment", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, committeeId);

    // First action
    await staffFetch(`/api/committees/${committeeId}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "APPROVE", votesFor: 30 }),
    });

    // Second action should fail
    const res = await staffFetch(`/api/committees/${committeeId}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "REJECT", votesFor: 5, votesAgainst: 30 }),
    });
    expect(res.status).toBe(409);
  });

  // --- Assignment Status Updates ---

  it("assignment IN_PROGRESS updates petition to IN_COMMITTEE", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "UNDER_REVIEW" });
    const assignment = await createTestAssignment(petition.id, committeeId);

    const res = await staffFetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(res.status).toBe(200);

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("IN_COMMITTEE");
  });
});
