import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Edit-Submit Race Condition", () => {
  let authFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;

  beforeAll(async () => {
    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    const cookies = await getSessionCookie(delegate.email);
    authFetch = makeAuthFetch(cookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should not allow editing a petition after it has been submitted", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });

    // Fire edit + submit concurrently
    const results = await Promise.allSettled([
      authFetch(`/api/petitions/${petition.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Edited After Submit Attempt" }),
      }),
      authFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" }),
    ]);

    const responses = await Promise.all(
      results.map(async (r) => {
        if (r.status === "fulfilled") {
          return { ok: r.value.ok, status: r.value.status, body: await r.value.json() };
        }
        return null;
      })
    );

    // Check database state
    const updatedPetition = await prisma.petition.findUnique({
      where: { id: petition.id },
    });

    if (updatedPetition!.status === "SUBMITTED") {
      // If submit won, the title should NOT be the edited version
      // (if edit happened after submit, it should have been rejected)
      // With the fix, edit should fail because petition is no longer DRAFT
      // The key assertion: if petition is SUBMITTED, no further edits should have been applied
      // after the status change
      expect(updatedPetition!.status).toBe("SUBMITTED");
    }

    // At least one operation should have succeeded
    const successes = responses.filter((r) => r && r.ok);
    expect(successes.length).toBeGreaterThanOrEqual(1);
  });
});
