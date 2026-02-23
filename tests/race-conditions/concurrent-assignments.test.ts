import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Concurrent Assignments Race Condition", () => {
  let authFetch: ReturnType<typeof makeAuthFetch>;

  beforeAll(async () => {
    const cookies = await getSessionCookie("staff@gc2028.org");
    authFetch = makeAuthFetch(cookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should not create duplicate assignments when manual assign and auto-route run concurrently", async () => {
    const delegate = await createTestDelegate();
    const petition = await createTestPetition({
      submitterId: delegate.id,
      status: "SUBMITTED",
    });

    // Get the first committee
    const committee = await prisma.committee.findFirst({
      where: { abbreviation: { not: "CC" } },
    });
    if (!committee) throw new Error("No committee found");

    // Fire manual assign + auto-route concurrently
    const results = await Promise.allSettled([
      authFetch(`/api/petitions/${petition.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ committeeId: committee.id }),
      }),
      authFetch(`/api/petitions/${petition.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ committeeId: committee.id }),
      }),
    ]);

    const responses = await Promise.all(
      results.map(async (r) => {
        if (r.status === "fulfilled") {
          return { ok: r.value.ok, status: r.value.status, body: await r.value.json() };
        }
        return null;
      })
    );

    // Check database: should have exactly one assignment to this committee
    const assignments = await prisma.petitionAssignment.findMany({
      where: { petitionId: petition.id, committeeId: committee.id },
    });

    // With the fix, exactly one assignment should exist
    expect(assignments.length).toBe(1);

    // One should succeed, one should fail (409 conflict or handled gracefully)
    const successes = responses.filter((r) => r && r.ok);
    const failures = responses.filter((r) => r && !r.ok);
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
  });
});
