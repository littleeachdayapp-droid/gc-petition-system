import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestDelegate, createTestPlenarySession, cleanupTestData } from "../helpers/factories";

describe("Plenary Session CRUD", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let adminFetch: ReturnType<typeof makeAuthFetch>;
  let conferenceId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const adminCookies = await getSessionCookie("admin@gc2028.org");
    adminFetch = makeAuthFetch(adminCookies);

    const delegate = await createTestDelegate({ role: "DELEGATE" });
    const delegateCookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(delegateCookies);

    const conference = await prisma.conference.findFirst({ where: { isActive: true } });
    conferenceId = conference!.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- CREATE ---

  it("STAFF can create plenary session", async () => {
    const res = await staffFetch("/api/plenary-sessions", {
      method: "POST",
      body: JSON.stringify({
        conferenceId,
        sessionNumber: 901,
        date: "2028-05-15",
        timeBlock: "MORNING",
        notes: "__test__Test session",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sessionNumber).toBe(901);
    expect(body.timeBlock).toBe("MORNING");
  });

  it("rejects session with missing required fields", async () => {
    const res = await staffFetch("/api/plenary-sessions", {
      method: "POST",
      body: JSON.stringify({ conferenceId, sessionNumber: 902 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("rejects session with invalid timeBlock", async () => {
    const res = await staffFetch("/api/plenary-sessions", {
      method: "POST",
      body: JSON.stringify({
        conferenceId,
        sessionNumber: 903,
        date: "2028-05-16",
        timeBlock: "MIDNIGHT",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("timeBlock");
  });

  it("DELEGATE cannot create plenary session", async () => {
    const res = await delegateFetch("/api/plenary-sessions", {
      method: "POST",
      body: JSON.stringify({
        conferenceId,
        sessionNumber: 904,
        date: "2028-05-17",
        timeBlock: "AFTERNOON",
      }),
    });
    expect(res.status).toBe(403);
  });

  // --- READ ---

  it("lists plenary sessions", async () => {
    const res = await staffFetch("/api/plenary-sessions");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("filters sessions by conferenceId", async () => {
    const res = await staffFetch(`/api/plenary-sessions?conferenceId=${conferenceId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((s: { conference: { id: string } }) => s.conference.id === conferenceId)).toBe(true);
  });

  it("gets session detail with items", async () => {
    const session = await createTestPlenarySession();
    const res = await staffFetch(`/api/plenary-sessions/${session.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(session.id);
    expect(body.items).toBeDefined();
  });

  it("returns 404 for non-existent session", async () => {
    const res = await staffFetch("/api/plenary-sessions/nonexistent-id");
    expect(res.status).toBe(404);
  });

  // --- UPDATE ---

  it("STAFF can update session", async () => {
    const session = await createTestPlenarySession();
    const res = await staffFetch(`/api/plenary-sessions/${session.id}`, {
      method: "PATCH",
      body: JSON.stringify({ timeBlock: "EVENING", notes: "__test__Updated notes" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timeBlock).toBe("EVENING");
  });

  it("DELEGATE cannot update session", async () => {
    const session = await createTestPlenarySession();
    const res = await delegateFetch(`/api/plenary-sessions/${session.id}`, {
      method: "PATCH",
      body: JSON.stringify({ notes: "Hacked" }),
    });
    expect(res.status).toBe(403);
  });

  // --- DELETE ---

  it("ADMIN can delete empty session", async () => {
    const session = await createTestPlenarySession();
    const res = await adminFetch(`/api/plenary-sessions/${session.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  it("STAFF cannot delete session (ADMIN required)", async () => {
    const session = await createTestPlenarySession();
    const res = await staffFetch(`/api/plenary-sessions/${session.id}`, { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  it("DELEGATE cannot delete session", async () => {
    const session = await createTestPlenarySession();
    const res = await delegateFetch(`/api/plenary-sessions/${session.id}`, { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});
