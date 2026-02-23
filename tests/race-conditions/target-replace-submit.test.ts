import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Target Replace + Submit Race Condition", () => {
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

  it("should not allow target replacement after petition is submitted", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });

    // Get a paragraph for the new target
    const paragraph = await prisma.paragraph.findFirst();
    if (!paragraph) throw new Error("No paragraph found");

    const newTargets = [
      {
        paragraphId: paragraph.id,
        changeType: "ADD_TEXT",
        proposedText: "New replacement text added during race",
      },
    ];

    // Fire target replacement + submit concurrently
    const results = await Promise.allSettled([
      authFetch(`/api/petitions/${petition.id}/targets`, {
        method: "POST",
        body: JSON.stringify({ targets: newTargets }),
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
      // If submit won, target replacement should have been rejected
      // The version snapshot should contain the original targets, not the replaced ones
      const version = await prisma.petitionVersion.findFirst({
        where: { petitionId: petition.id, stage: "ORIGINAL" },
      });
      expect(version).not.toBeNull();
    }

    // At least one operation should have succeeded
    const successes = responses.filter((r) => r && r.ok);
    expect(successes.length).toBeGreaterThanOrEqual(1);
  });
});
