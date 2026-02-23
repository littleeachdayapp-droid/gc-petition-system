import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Concurrent Amendments Race Condition", () => {
  let authFetch: ReturnType<typeof makeAuthFetch>;
  let committeeId: string;

  beforeAll(async () => {
    const cookies = await getSessionCookie("staff@gc2028.org");
    authFetch = makeAuthFetch(cookies);

    const committee = await prisma.committee.findFirst();
    if (!committee) throw new Error("No committee found");
    committeeId = committee.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should not create duplicate version numbers when two amendments are submitted concurrently", async () => {
    // Create a petition with ORIGINAL version (status IN_COMMITTEE)
    const delegate = await createTestDelegate();
    const petition = await createTestPetition({
      submitterId: delegate.id,
      status: "IN_COMMITTEE",
    });

    // Create the ORIGINAL version (versionNum: 1)
    const staffUser = await prisma.user.findFirst({ where: { role: "STAFF" } });
    await prisma.petitionVersion.create({
      data: {
        petitionId: petition.id,
        versionNum: 1,
        stage: "ORIGINAL",
        snapshotJson: { title: petition.title },
        createdById: staffUser!.id,
      },
    });

    // Fire two amendments concurrently
    const amendedTargets = [
      { changeType: "REPLACE_TEXT", proposedText: "Amendment version A" },
    ];
    const amendedTargetsB = [
      { changeType: "REPLACE_TEXT", proposedText: "Amendment version B" },
    ];

    const results = await Promise.allSettled([
      authFetch(`/api/committees/${committeeId}/amend`, {
        method: "POST",
        body: JSON.stringify({ petitionId: petition.id, amendedTargets }),
      }),
      authFetch(`/api/committees/${committeeId}/amend`, {
        method: "POST",
        body: JSON.stringify({ petitionId: petition.id, amendedTargets: amendedTargetsB }),
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

    // Check database: version numbers should be unique
    const versions = await prisma.petitionVersion.findMany({
      where: { petitionId: petition.id },
      orderBy: { versionNum: "asc" },
    });

    const versionNums = versions.map((v) => v.versionNum);
    const uniqueNums = new Set(versionNums);

    // All version numbers should be unique (no collisions)
    expect(uniqueNums.size).toBe(versionNums.length);

    // At least the ORIGINAL + one amendment should exist
    expect(versions.length).toBeGreaterThanOrEqual(2);

    // Both requests should have resolved (not thrown)
    const resolved = responses.filter((r) => r !== null);
    expect(resolved.length).toBe(2);
  });
});
