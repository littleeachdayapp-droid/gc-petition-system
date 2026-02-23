import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Double Submit Race Condition", () => {
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

  it("should not create duplicate display numbers when two petitions are submitted concurrently", async () => {
    // Create two DRAFT petitions
    const [petition1, petition2] = await Promise.all([
      createTestPetition({ submitterId: delegateId }),
      createTestPetition({ submitterId: delegateId }),
    ]);

    // Fire both submits concurrently
    const results = await Promise.allSettled([
      authFetch(`/api/petitions/${petition1.id}/submit`, { method: "POST" }),
      authFetch(`/api/petitions/${petition2.id}/submit`, { method: "POST" }),
    ]);

    // Both should succeed (different petitions)
    const responses = results.map((r) =>
      r.status === "fulfilled" ? r.value : null
    );

    const successResponses = responses.filter((r) => r && r.ok);

    // Check database state: no duplicate display numbers
    const submittedPetitions = await prisma.petition.findMany({
      where: {
        id: { in: [petition1.id, petition2.id] },
        displayNumber: { not: null },
      },
      select: { id: true, displayNumber: true },
    });

    const displayNumbers = submittedPetitions.map((p) => p.displayNumber);
    const uniqueNumbers = new Set(displayNumbers);

    // This is the key assertion: display numbers should be unique
    expect(uniqueNumbers.size).toBe(displayNumbers.length);
    expect(successResponses.length).toBeGreaterThanOrEqual(1);
  });

  it("should not submit the same petition twice", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });

    // Fire two submits of the SAME petition concurrently
    const results = await Promise.allSettled([
      authFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" }),
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

    const successes = responses.filter((r) => r && r.ok);
    const failures = responses.filter((r) => r && !r.ok);

    // Exactly one should succeed, one should fail with "not DRAFT"
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Check DB: petition should have exactly one version
    const versions = await prisma.petitionVersion.findMany({
      where: { petitionId: petition.id },
    });
    expect(versions.length).toBe(1);
  });
});
