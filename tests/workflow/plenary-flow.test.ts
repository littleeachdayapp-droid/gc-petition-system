import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import {
  createTestPetition, createTestDelegate, createTestPlenarySession,
  createTestCalendarItem, cleanupTestData,
} from "../helpers/factories";

describe("Plenary Calendar & Voting Workflow", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;
  let sessionId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const delegate = await createTestDelegate();
    delegateId = delegate.id;

    const session = await createTestPlenarySession();
    sessionId = session.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- Calendar Placement ---

  it("adds APPROVED_BY_COMMITTEE petition to calendar → ON_CALENDAR", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "APPROVED_BY_COMMITTEE" });
    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id, calendarType: "REGULAR" }),
    });
    expect(res.status).toBe(201);

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("ON_CALENDAR");
  });

  it("adds AMENDED petition to calendar", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "AMENDED" });
    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id, calendarType: "CONSENT" }),
    });
    expect(res.status).toBe(201);
  });

  it("adds REJECTED_BY_COMMITTEE petition to calendar (minority report)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "REJECTED_BY_COMMITTEE" });
    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id, calendarType: "SPECIAL_ORDER" }),
    });
    expect(res.status).toBe(201);
  });

  it("rejects adding DRAFT petition to calendar", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "DRAFT" });
    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id, calendarType: "REGULAR" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("committee action");
  });

  it("rejects adding SUBMITTED petition to calendar", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "SUBMITTED" });
    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id, calendarType: "REGULAR" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate petition on same session", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "APPROVED_BY_COMMITTEE" });
    await createTestCalendarItem(petition.id, sessionId);
    // Manually set status since factory doesn't do the status update
    await prisma.petition.update({ where: { id: petition.id }, data: { status: "ON_CALENDAR" } });

    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id, calendarType: "REGULAR" }),
    });
    expect(res.status).toBe(409);
  });

  // --- Plenary Voting ---

  it("ADOPT vote → ADOPTED", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "ADOPT", votesFor: 500, votesAgainst: 200, votesAbstain: 50 }),
    });
    expect(res.status).toBe(201);

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("ADOPTED");
  });

  it("DEFEAT vote → DEFEATED", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "DEFEAT", votesFor: 200, votesAgainst: 500 }),
    });

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("DEFEATED");
  });

  it("AMEND vote → AMENDED + creates PLENARY_AMENDED version", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    // Create ORIGINAL version first
    const staffUser = await prisma.user.findFirst({ where: { role: "STAFF" } });
    await prisma.petitionVersion.create({
      data: { petitionId: petition.id, versionNum: 1, stage: "ORIGINAL", snapshotJson: {}, createdById: staffUser!.id },
    });
    const item = await createTestCalendarItem(petition.id, sessionId);

    await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "AMEND", votesFor: 400, votesAgainst: 300, notes: "Floor amendment" }),
    });

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("AMENDED");

    const version = await prisma.petitionVersion.findFirst({
      where: { petitionId: petition.id, stage: "PLENARY_AMENDED" },
    });
    expect(version).not.toBeNull();
    expect(version!.versionNum).toBe(2);
  });

  it("TABLE vote → stays ON_CALENDAR", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "TABLE", votesFor: 400 }),
    });

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("ON_CALENDAR");
  });

  it("REFER_BACK vote → IN_COMMITTEE", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "REFER_BACK", votesFor: 400 }),
    });

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("IN_COMMITTEE");
  });

  it("rejects second final vote on same item", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "ADOPT", votesFor: 500 }),
    });

    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "DEFEAT", votesFor: 200 }),
    });
    expect(res.status).toBe(409);
  });

  // --- Calendar Item Removal ---

  it("removes item with no actions", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.status).toBe("APPROVED_BY_COMMITTEE");
  });

  it("rejects removing item with recorded votes", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "ON_CALENDAR" });
    const item = await createTestCalendarItem(petition.id, sessionId);

    // Record a vote
    await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "ADOPT", votesFor: 500 }),
    });

    const res = await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}`, { method: "DELETE" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("recorded votes");
  });
});
