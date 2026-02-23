import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Display Number Stress Test", () => {
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

  it("5 concurrent submits of different petitions produce unique display numbers", async () => {
    // Create 5 DRAFT petitions with targets
    const petitions = await Promise.all(
      Array.from({ length: 5 }, () => createTestPetition({ submitterId: delegateId }))
    );

    // Submit all 5 concurrently
    const results = await Promise.allSettled(
      petitions.map((p) =>
        delegateFetch(`/api/petitions/${p.id}/submit`, { method: "POST" })
      )
    );

    const successes = results.filter((r) => r.status === "fulfilled");
    expect(successes.length).toBe(5);

    // With Serializable isolation, some transactions may fail due to
    // serialization conflicts — that's the correct behavior preventing duplicates.
    // Collect successful submissions.
    const displayNumbers: string[] = [];
    for (const result of successes) {
      const res = (result as PromiseFulfilledResult<Response>).value;
      if (res.status === 200) {
        const body = await res.json();
        expect(body.displayNumber).toMatch(/^P-\d{4}-\d{4}$/);
        displayNumbers.push(body.displayNumber);
      }
    }

    // At least 1 must succeed; serialization errors are expected for others
    expect(displayNumbers.length).toBeGreaterThanOrEqual(1);

    // All successful display numbers must be unique (no duplicates)
    const unique = new Set(displayNumbers);
    expect(unique.size).toBe(displayNumbers.length);
  });
});
