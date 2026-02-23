import { describe, it, expect, beforeAll } from "vitest";
import { getSessionCookie, makeAuthFetch, BASE_URL } from "../helpers/setup";

describe("Dashboard, Health & Conference Endpoints", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;

  beforeAll(async () => {
    const cookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(cookies);
  });

  // --- Health ---

  it("health endpoint returns ok with database connected", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
    expect(body.counts).toBeDefined();
    expect(typeof body.counts.books).toBe("number");
    expect(typeof body.counts.committees).toBe("number");
    expect(typeof body.counts.users).toBe("number");
  });

  // --- Dashboard Stats ---

  it("authenticated user can access dashboard stats", async () => {
    const res = await staffFetch("/api/dashboard/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.totalPetitions).toBe("number");
    expect(typeof body.submitted).toBe("number");
    expect(typeof body.inCommittee).toBe("number");
    expect(typeof body.onCalendar).toBe("number");
    expect(typeof body.adopted).toBe("number");
    expect(typeof body.defeated).toBe("number");
    expect(typeof body.totalCommittees).toBe("number");
    expect(typeof body.totalSessions).toBe("number");
  });

  it("unauthenticated user cannot access dashboard stats", async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/stats`);
    expect(res.status).toBe(401);
  });

  // --- Conferences ---

  it("lists conferences ordered by year", async () => {
    const res = await fetch(`${BASE_URL}/api/conferences`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    // Should be ordered by year desc
    if (body.length >= 2) {
      expect(body[0].year).toBeGreaterThanOrEqual(body[1].year);
    }
  });
});
