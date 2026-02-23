import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestAssignment, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Committee Actions Race Condition", () => {
  let authFetch: ReturnType<typeof makeAuthFetch>;
  let committeeId: string;

  beforeAll(async () => {
    // Use existing staff user for auth
    const cookies = await getSessionCookie("staff@gc2028.org");
    authFetch = makeAuthFetch(cookies);

    const committee = await prisma.committee.findFirst();
    if (!committee) throw new Error("No committee found");
    committeeId = committee.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should not create duplicate committee actions when two votes are recorded concurrently", async () => {
    // Create a petition in IN_COMMITTEE status with an assignment
    const delegate = await createTestDelegate();
    const petition = await createTestPetition({
      submitterId: delegate.id,
      status: "IN_COMMITTEE",
    });
    const assignment = await createTestAssignment(petition.id, committeeId);

    // Fire two APPROVE actions concurrently on the same assignment
    const results = await Promise.allSettled([
      authFetch(`/api/committees/${committeeId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          assignmentId: assignment.id,
          action: "APPROVE",
          votesFor: 30,
          votesAgainst: 10,
          votesAbstain: 5,
        }),
      }),
      authFetch(`/api/committees/${committeeId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          assignmentId: assignment.id,
          action: "REJECT",
          votesFor: 10,
          votesAgainst: 30,
          votesAbstain: 5,
        }),
      }),
    ]);

    const responses = await Promise.all(
      results.map(async (r) => {
        if (r.status === "fulfilled") {
          return { ok: r.value.ok, status: r.value.status };
        }
        return null;
      })
    );

    // Check database: there should be exactly one committee action
    const actions = await prisma.committeeAction.findMany({
      where: { assignmentId: assignment.id },
    });

    // With the fix, only one action should exist
    // Without the fix, two actions could exist (the bug)
    expect(actions.length).toBe(1);

    // Petition should have a consistent status
    const updatedPetition = await prisma.petition.findUnique({
      where: { id: petition.id },
    });
    expect(updatedPetition).not.toBeNull();
    // Status should match whichever action won
    expect(["APPROVED_BY_COMMITTEE", "REJECTED_BY_COMMITTEE"]).toContain(
      updatedPetition!.status
    );
  });
});
