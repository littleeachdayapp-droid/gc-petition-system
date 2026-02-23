import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import { createTestPetition, createTestDelegate, createTestAssignment, cleanupTestData } from "../helpers/factories";

describe("Input Validation & Sanitization", () => {
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

  // --- Petition Creation Validation ---

  it("rejects petition missing required fields (title)", async () => {
    const res = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({ actionType: "AMEND", targetBook: "DISCIPLINE", conferenceId }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("rejects petition missing actionType", async () => {
    const res = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({ title: "__test__Missing actionType", targetBook: "DISCIPLINE", conferenceId }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects petition missing targetBook", async () => {
    const res = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({ title: "__test__Missing targetBook", actionType: "AMEND", conferenceId }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects petition missing conferenceId", async () => {
    const res = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({ title: "__test__Missing conference", actionType: "AMEND", targetBook: "DISCIPLINE" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects petition with non-existent conferenceId", async () => {
    const res = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({
        title: "__test__Bad conference",
        actionType: "AMEND",
        targetBook: "DISCIPLINE",
        conferenceId: "nonexistent-id",
      }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Conference not found");
  });

  it("stores XSS in title without execution (safely escaped by Prisma)", async () => {
    const xssTitle = "__test__<script>alert('xss')</script>";
    const res = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({
        title: xssTitle,
        actionType: "AMEND",
        targetBook: "DISCIPLINE",
        conferenceId,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    // Stored as-is (no stripping) — XSS prevention is at render time
    expect(body.title).toBe(xssTitle);
  });

  it("handles SQL injection in search safely (parameterized by Prisma)", async () => {
    const res = await delegateFetch("/api/petitions?search='; DROP TABLE \"Petition\" --");
    expect(res.status).toBe(200);
  });

  // --- Committee Action Validation ---

  it("rejects committee action with missing action type", async () => {
    const committee = await prisma.committee.findFirst();
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, committee!.id);

    const res = await staffFetch(`/api/committees/${committee!.id}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects committee action with missing assignmentId", async () => {
    const committee = await prisma.committee.findFirst();
    const res = await staffFetch(`/api/committees/${committee!.id}/actions`, {
      method: "POST",
      body: JSON.stringify({ action: "APPROVE", votesFor: 30 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects committee action with assignment from different committee", async () => {
    const committees = await prisma.committee.findMany({ take: 2 });
    if (committees.length < 2) return;

    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const assignment = await createTestAssignment(petition.id, committees[0].id);

    const res = await staffFetch(`/api/committees/${committees[1].id}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment.id, action: "APPROVE", votesFor: 30 }),
    });
    // Should fail because assignment belongs to a different committee
    expect([400, 404]).toContain(res.status);
  });

  // --- Registration Validation ---

  it("rejects registration missing name", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "__test__missing-name@gc2028.org", password: "password123" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("rejects registration missing email", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test User", password: "password123" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects registration missing password", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test User", email: "__test__missing-pw@gc2028.org" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects registration with short password (< 8 chars)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test User", email: "__test__short-pw@gc2028.org", password: "short" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("8 characters");
  });

  it("rejects duplicate email registration", async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const email = `__test__dup-${suffix}@gc2028.org`;

    // Register first time
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test User", email, password: "password123" }),
    });

    // Register second time with same email
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test User 2", email, password: "password456" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already exists");
  });

  it("successful registration returns PUBLIC role", async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "__test__New User",
        email: `__test__new-${suffix}@gc2028.org`,
        password: "password123",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.role).toBe("PUBLIC");
  });

  // --- Targets Validation ---

  it("rejects submitting petition without targets", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, withTarget: false });
    const res = await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("at least one target");
  });
});
