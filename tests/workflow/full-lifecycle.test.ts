import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import { createTestDelegate, createTestPlenarySession, cleanupTestData } from "../helpers/factories";

describe("Full Petition Lifecycle (DRAFT → ADOPTED)", () => {
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;

  beforeAll(async () => {
    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    const delegateCookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(delegateCookies);

    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("walks a petition through DRAFT → SUBMITTED → UNDER_REVIEW → IN_COMMITTEE → APPROVED_BY_COMMITTEE → ON_CALENDAR → ADOPTED", async () => {
    // 1. CREATE DRAFT
    const conference = await prisma.conference.findFirst({ where: { isActive: true } });
    const paragraph = await prisma.paragraph.findFirst();

    const createRes = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({
        title: "__test__Full Lifecycle Petition",
        summary: "Test petition for lifecycle verification",
        rationale: "Ensures all status transitions work end-to-end",
        actionType: "AMEND",
        targetBook: "DISCIPLINE",
        conferenceId: conference!.id,
      }),
    });
    expect(createRes.status).toBe(201);
    const petition = await createRes.json();
    const petitionId = petition.id;
    expect(petition.status).toBe("DRAFT");

    // Add target
    await delegateFetch(`/api/petitions/${petitionId}/targets`, {
      method: "POST",
      body: JSON.stringify({
        targets: [{
          paragraphId: paragraph!.id,
          changeType: "REPLACE_TEXT",
          proposedText: "Amended text for lifecycle test",
        }],
      }),
    });

    // 2. SUBMIT → SUBMITTED
    const submitRes = await delegateFetch(`/api/petitions/${petitionId}/submit`, { method: "POST" });
    expect(submitRes.status).toBe(200);
    const submitted = await submitRes.json();
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.displayNumber).toMatch(/^P-\d{4}-\d{4}$/);
    const displayNumber = submitted.displayNumber;

    // Verify ORIGINAL version created
    const origVersion = await prisma.petitionVersion.findFirst({
      where: { petitionId, stage: "ORIGINAL" },
    });
    expect(origVersion).not.toBeNull();
    expect(origVersion!.versionNum).toBe(1);

    // 3. ASSIGN → UNDER_REVIEW
    const committee = await prisma.committee.findFirst({ where: { abbreviation: { not: "CC" } } });
    const assignRes = await staffFetch(`/api/petitions/${petitionId}/assign`, {
      method: "POST",
      body: JSON.stringify({ committeeId: committee!.id }),
    });
    expect(assignRes.status).toBe(201);

    let current = await prisma.petition.findUnique({ where: { id: petitionId } });
    expect(current!.status).toBe("UNDER_REVIEW");

    // 4. Mark assignment IN_PROGRESS → IN_COMMITTEE
    const assignment = await prisma.petitionAssignment.findFirst({ where: { petitionId } });
    const progressRes = await staffFetch(`/api/assignments/${assignment!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });
    expect(progressRes.status).toBe(200);

    current = await prisma.petition.findUnique({ where: { id: petitionId } });
    expect(current!.status).toBe("IN_COMMITTEE");

    // 5. Committee APPROVE → APPROVED_BY_COMMITTEE
    const approveRes = await staffFetch(`/api/committees/${committee!.id}/actions`, {
      method: "POST",
      body: JSON.stringify({
        assignmentId: assignment!.id,
        action: "APPROVE",
        votesFor: 30,
        votesAgainst: 5,
      }),
    });
    expect(approveRes.status).toBe(201);

    current = await prisma.petition.findUnique({ where: { id: petitionId } });
    expect(current!.status).toBe("APPROVED_BY_COMMITTEE");

    // 6. Add to plenary calendar → ON_CALENDAR
    const session = await createTestPlenarySession();
    const calendarRes = await staffFetch(`/api/plenary-sessions/${session.id}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId, calendarType: "REGULAR" }),
    });
    expect(calendarRes.status).toBe(201);

    current = await prisma.petition.findUnique({ where: { id: petitionId } });
    expect(current!.status).toBe("ON_CALENDAR");

    // 7. Plenary ADOPT vote → ADOPTED
    const calendarItem = await prisma.calendarItem.findFirst({ where: { petitionId } });
    const voteRes = await staffFetch(`/api/plenary-sessions/${session.id}/items/${calendarItem!.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "ADOPT", votesFor: 600, votesAgainst: 150, votesAbstain: 50 }),
    });
    expect(voteRes.status).toBe(201);

    current = await prisma.petition.findUnique({ where: { id: petitionId } });
    expect(current!.status).toBe("ADOPTED");

    // Verify display number hasn't changed
    expect(current!.displayNumber).toBe(displayNumber);

    // Verify full version history
    const versions = await prisma.petitionVersion.findMany({
      where: { petitionId },
      orderBy: { versionNum: "asc" },
    });
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].stage).toBe("ORIGINAL");
  });

  it("walks a petition through defeat path: DRAFT → SUBMITTED → ... → ON_CALENDAR → DEFEATED", async () => {
    const conference = await prisma.conference.findFirst({ where: { isActive: true } });
    const paragraph = await prisma.paragraph.findFirst();

    // Create + add target + submit
    const createRes = await delegateFetch("/api/petitions", {
      method: "POST",
      body: JSON.stringify({
        title: "__test__Defeat Path Petition",
        actionType: "AMEND",
        targetBook: "DISCIPLINE",
        conferenceId: conference!.id,
      }),
    });
    const petition = await createRes.json();
    await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({ targets: [{ paragraphId: paragraph!.id, changeType: "REPLACE_TEXT", proposedText: "Text" }] }),
    });
    await delegateFetch(`/api/petitions/${petition.id}/submit`, { method: "POST" });

    // Assign + progress + reject by committee
    const committee = await prisma.committee.findFirst({ where: { abbreviation: { not: "CC" } } });
    await staffFetch(`/api/petitions/${petition.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ committeeId: committee!.id }),
    });
    const assignment = await prisma.petitionAssignment.findFirst({ where: { petitionId: petition.id } });
    await staffFetch(`/api/assignments/${assignment!.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });

    // Committee rejects → REJECTED_BY_COMMITTEE (still can go to plenary as minority report)
    await staffFetch(`/api/committees/${committee!.id}/actions`, {
      method: "POST",
      body: JSON.stringify({ assignmentId: assignment!.id, action: "REJECT", votesFor: 5, votesAgainst: 30 }),
    });

    let current = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(current!.status).toBe("REJECTED_BY_COMMITTEE");

    // Add to calendar as SPECIAL_ORDER (minority report)
    const session = await createTestPlenarySession();
    await staffFetch(`/api/plenary-sessions/${session.id}/items`, {
      method: "POST",
      body: JSON.stringify({ petitionId: petition.id, calendarType: "SPECIAL_ORDER" }),
    });

    // Plenary defeats it
    const calendarItem = await prisma.calendarItem.findFirst({ where: { petitionId: petition.id } });
    await staffFetch(`/api/plenary-sessions/${session.id}/items/${calendarItem!.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ action: "DEFEAT", votesFor: 200, votesAgainst: 500 }),
    });

    current = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(current!.status).toBe("DEFEATED");
  });
});
