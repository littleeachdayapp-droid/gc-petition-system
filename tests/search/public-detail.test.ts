import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, BASE_URL } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Public Petition Detail API", () => {
  let delegateId: string;

  beforeAll(async () => {
    const delegate = await createTestDelegate();
    delegateId = delegate.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("returns SUBMITTED petition with nested data", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });
    const res = await fetch(`${BASE_URL}/api/public/petitions/${petition.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(petition.id);
    expect(body.submitter).toBeDefined();
    expect(body.targets).toBeDefined();
    expect(body.versions).toBeDefined();
    expect(body.assignments).toBeDefined();
    expect(body.calendarItems).toBeDefined();
  });

  it("returns 404 for DRAFT petition (not exposed publicly)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "DRAFT" });
    const res = await fetch(`${BASE_URL}/api/public/petitions/${petition.id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent petition", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions/nonexistent-id`);
    expect(res.status).toBe(404);
  });
});
