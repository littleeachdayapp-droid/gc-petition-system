import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import { createTestPetition, createTestDelegate, createTestAssignment, cleanupTestData } from "../helpers/factories";

describe("Input Validation Edge Cases", () => {
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;
  let conferenceId: string;

  beforeAll(async () => {
    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    const cookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(cookies);

    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const conference = await prisma.conference.findFirst({ where: { isActive: true } });
    conferenceId = conference!.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- Unicode & Special Characters ---

  it("stores and retrieves Unicode/emoji in petition title", async () => {
    const title = "__test__Petition 🗳️ résolution à l'église";
    const res = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({ title, actionType: "AMEND", targetBook: "DISCIPLINE", conferenceId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe(title);
  });

  it("stores very long proposedText (10K chars)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    const paragraph = await prisma.paragraph.findFirst();
    const longText = "A".repeat(10000);

    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({
        targets: [{ paragraphId: paragraph!.id, changeType: "REPLACE_TEXT", proposedText: longText }],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].proposedText.length).toBe(10000);
  });

  // --- Invalid Enum Values ---

  it("rejects invalid actionType enum", async () => {
    const res = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({
        title: "__test__Invalid actionType",
        actionType: "INVALID_ACTION",
        targetBook: "DISCIPLINE",
        conferenceId,
      }),
    });
    // Prisma will reject the invalid enum — should be 500 or 400
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects invalid targetBook enum", async () => {
    const res = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({
        title: "__test__Invalid targetBook",
        actionType: "AMEND",
        targetBook: "INVALID_BOOK",
        conferenceId,
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // --- Pagination Edge Cases ---

  it("page beyond total returns empty array", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?page=9999&limit=20`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.petitions).toEqual([]);
    expect(body.pagination.page).toBe(9999);
  });

  it("limit of 0 treated as minimum or default", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?limit=0`);
    expect(res.status).toBe(200);
    // Should not crash; returns either empty or defaults to some limit
  });

  it("negative page handled gracefully", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?page=-1`);
    // Server should respond (not hang); 400 or 500 are acceptable since
    // negative skip is invalid — the key is it returns a response
    expect([200, 400, 500]).toContain(res.status);
  });

  // --- Empty/Whitespace Fields ---

  it("petition with empty string title is rejected", async () => {
    const res = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({ title: "", actionType: "AMEND", targetBook: "DISCIPLINE", conferenceId }),
    });
    expect(res.status).toBe(400);
  });

  // --- Committee Action Vote Counts ---

  it("accepts committee action with zero vote counts", async () => {
    const committee = await prisma.committee.findFirst({ where: { abbreviation: { not: "CC" } } });
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, committee!.id);

    const res = await staffFetch(`/api/committees/${committee!.id}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "APPROVE", votesFor: 0, votesAgainst: 0 }),
    });
    // Should accept — vote counts are optional metadata
    expect(res.status).toBe(201);
  });

  // --- Display Number Immutability ---

  it("display number does not change after submission", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    const submitRes = await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });
    const submitted = await submitRes.json();
    const displayNumber = submitted.displayNumber;

    // Query again
    const getRes = await delegateFetch(`/api/petitions/${petition.id}`);
    const fetched = await getRes.json();
    expect(fetched.displayNumber).toBe(displayNumber);
  });

  // --- Display Number Format ---

  it("display number is zero-padded to 4 digits", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });
    const submitRes = await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });
    const submitted = await submitRes.json();
    // Format: P-YYYY-NNNN where NNNN is zero-padded
    expect(submitted.displayNumber).toMatch(/^P-\d{4}-\d{4}$/);
  });
});
