import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import {
  createTestPetition, createTestDelegate, createTestPlenarySession,
  createTestCalendarItem, cleanupTestData,
} from "../helpers/factories";

describe("Calendar Re-add & Advanced Workflows", () => {
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

  it("remove from calendar then re-add works correctly", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "APPROVED_BY_COMMITTEE" });

    // Add to calendar
    const addRes = await staffFetch(`/api/plenary-sessions/${sessionId}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id, calendarType: "REGULAR" }),
    });
    expect(addRes.status).toBe(201);
    const item = await addRes.json();

    let current = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(current!.status).toBe("ON_CALENDAR");

    // Remove from calendar (reverts to APPROVED_BY_COMMITTEE)
    const removeRes = await staffFetch(`/api/plenary-sessions/${sessionId}/items/${item.id}`, { method: "DELETE" });
    expect(removeRes.status).toBe(200);

    current = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(current!.status).toBe("APPROVED_BY_COMMITTEE");

    // Re-add to calendar
    const reAddRes = await staffFetch(`/api/plenary-sessions/${sessionId}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id, calendarType: "CONSENT" }),
    });
    expect(reAddRes.status).toBe(201);

    current = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(current!.status).toBe("ON_CALENDAR");
  });

  it("amendment version sequencing: v1 → v2 → v3", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "IN_COMMITTEE" });
    const staffUser = await prisma.user.findFirst({ where: { role: "STAFF" } });
    const committee = await prisma.committee.findFirst({ where: { abbreviation: { not: "CC" } } });

    // Create v1 (ORIGINAL)
    await prisma.petitionVersion.create({
      data: { petitionId: petition.id, versionNum: 1, stage: "ORIGINAL", snapshotJson: {}, createdById: staffUser!.id },
    });

    // First amendment → v2
    const amend1 = await staffFetch(`/api/committees/${committee!.id}/amend`, {
      method: "POST",
      body: JSON.stringify({
        petitionId: petition.id,
        amendedTargets: [{ changeType: "REPLACE_TEXT", proposedText: "First amendment" }],
      }),
    });
    expect(amend1.status).toBe(201);
    const v2 = await amend1.json();
    expect(v2.versionNum).toBe(2);
    expect(v2.stage).toBe("COMMITTEE_AMENDED");

    // Second amendment → v3
    const amend2 = await staffFetch(`/api/committees/${committee!.id}/amend`, {
      method: "POST",
      body: JSON.stringify({
        petitionId: petition.id,
        amendedTargets: [{ changeType: "REPLACE_TEXT", proposedText: "Second amendment" }],
      }),
    });
    expect(amend2.status).toBe(201);
    const v3 = await amend2.json();
    expect(v3.versionNum).toBe(3);

    // Verify full version history
    const versions = await prisma.petitionVersion.findMany({
      where: { petitionId: petition.id },
      orderBy: { versionNum: "asc" },
    });
    expect(versions.length).toBe(3);
    expect(versions[0].versionNum).toBe(1);
    expect(versions[1].versionNum).toBe(2);
    expect(versions[2].versionNum).toBe(3);
  });

  it("calendar item ordering is preserved", async () => {
    const p1 = await createTestPetition({ submitterId: delegateId, status: "APPROVED_BY_COMMITTEE" });
    const p2 = await createTestPetition({ submitterId: delegateId, status: "APPROVED_BY_COMMITTEE" });
    const p3 = await createTestPetition({ submitterId: delegateId, status: "APPROVED_BY_COMMITTEE" });

    const session = await createTestPlenarySession();
    await staffFetch(`/api/plenary-sessions/${session.id}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: p1.id, calendarType: "REGULAR" }),
    });
    await staffFetch(`/api/plenary-sessions/${session.id}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: p2.id, calendarType: "REGULAR" }),
    });
    await staffFetch(`/api/plenary-sessions/${session.id}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: p3.id, calendarType: "REGULAR" }),
    });

    // Get session detail — items should be in orderNumber order
    const res = await staffFetch(`/api/plenary-sessions/${session.id}`);
    const body = await res.json();
    const items = body.items;
    expect(items.length).toBe(3);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].orderNumber).toBeGreaterThan(items[i - 1].orderNumber);
    }
  });
});
