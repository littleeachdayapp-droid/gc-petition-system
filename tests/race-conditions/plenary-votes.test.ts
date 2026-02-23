import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma } from "../helpers/setup";
import {
  createTestPetition,
  createTestDelegate,
  createTestPlenarySession,
  createTestCalendarItem,
  cleanupTestData,
} from "../helpers/factories";

describe("Plenary Votes Race Condition", () => {
  let authFetch: ReturnType<typeof makeAuthFetch>;

  beforeAll(async () => {
    const cookies = await getSessionCookie("staff@gc2028.org");
    authFetch = makeAuthFetch(cookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should not create duplicate plenary actions when two votes are recorded concurrently", async () => {
    const delegate = await createTestDelegate();
    const petition = await createTestPetition({
      submitterId: delegate.id,
      status: "ON_CALENDAR",
    });

    const session = await createTestPlenarySession();
    const calendarItem = await createTestCalendarItem(petition.id, session.id);

    // Fire two votes concurrently on the same calendar item
    const results = await Promise.allSettled([
      authFetch(
        `/api/plenary-sessions/${session.id}/items/${calendarItem.id}/vote`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "ADOPT",
            votesFor: 500,
            votesAgainst: 200,
            votesAbstain: 50,
          }),
        }
      ),
      authFetch(
        `/api/plenary-sessions/${session.id}/items/${calendarItem.id}/vote`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "DEFEAT",
            votesFor: 200,
            votesAgainst: 500,
            votesAbstain: 50,
          }),
        }
      ),
    ]);

    const responses = await Promise.all(
      results.map(async (r) => {
        if (r.status === "fulfilled") {
          return { ok: r.value.ok, status: r.value.status };
        }
        return null;
      })
    );

    // Check database: should have exactly one plenary action for this item
    const actions = await prisma.plenaryAction.findMany({
      where: { calendarItemId: calendarItem.id },
    });

    // With the fix, only one vote should be recorded
    expect(actions.length).toBe(1);

    // Petition should have a consistent final status
    const updatedPetition = await prisma.petition.findUnique({
      where: { id: petition.id },
    });
    expect(["ADOPTED", "DEFEATED"]).toContain(updatedPetition!.status);
  });
});
