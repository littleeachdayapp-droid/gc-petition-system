import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import {
  createTestPetition, createTestDelegate, createTestPlenarySession,
  createTestCalendarItem, cleanupTestData,
} from "../helpers/factories";

describe("Calendar Item PATCH", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;
  let sessionId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    const delegateCookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(delegateCookies);

    const session = await createTestPlenarySession();
    sessionId = session.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("updates calendarType", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ calendarType: "CONSENT" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.calendarType).toBe("CONSENT");
  });

  it("updates orderNumber", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ orderNumber: 99 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orderNumber).toBe(99);
  });

  it("rejects invalid calendarType", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ calendarType: "INVALID_TYPE" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("calendarType");
  });

  it("returns 404 for item from different session", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    const otherSession = await createTestPlenarySession();
    const res = await staffFetch(`/api/plenary-sessions/${otherSession.id}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ calendarType: "CONSENT" }),
    });
    expect(res.status).toBe(404);
  });

  it("DELEGATE cannot update calendar item", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    const res = await delegateFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ calendarType: "CONSENT" }),
    });
    expect(res.status).toBe(403);
  });
});
