import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import { createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Session & Auth Security", () => {
  let adminFetch: ReturnType<typeof makeAuthFetch>;

  beforeAll(async () => {
    const adminCookies = await getSessionCookie("admin@gc2028.org");
    adminFetch = makeAuthFetch(adminCookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("request with invalid session cookie returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/petitions`, {
      headers: {
        Cookie: "next-auth.session-token=invalid-token-value-12345",
        "Content-Type": "application/json",
      },
    });
    expect(res.status).toBe(401);
  });

  it("request with no cookies returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/petitions`);
    expect(res.status).toBe(401);
  });

  it("user role demotion is enforced on next request", async () => {
    // Create a STAFF user
    const staffUser = await createTestDelegate({ role: "STAFF" });
    const staffCookies = await getSessionCookie(staffUser.email);
    const staffFetch = makeAuthFetch(staffCookies);

    // Verify STAFF access works
    const res1 = await staffFetch("/api/admin/pipeline");
    expect(res1.status).toBe(200);

    // Demote to DELEGATE via DB
    await prisma.user.update({
      where: { id: staffUser.id },
      data: { role: "DELEGATE" },
    });

    // NextAuth JWT contains the role at sign-in time.
    // Re-sign in to get new token with DELEGATE role
    const newCookies = await getSessionCookie(staffUser.email);
    const demotedFetch = makeAuthFetch(newCookies);

    const res2 = await demotedFetch("/api/admin/pipeline");
    expect(res2.status).toBe(403);
  });

  it("protected API routes require authentication", async () => {
    const protectedRoutes = [
      "/api/petitions",
      "/api/dashboard/stats",
      "/api/plenary-sessions",
    ];

    for (const route of protectedRoutes) {
      const res = await fetch(`${BASE_URL}${route}`);
      expect(res.status).toBe(401);
    }
  });

  it("public API routes do NOT require authentication", async () => {
    const publicRoutes = [
      "/api/public/petitions",
      "/api/public/results",
      "/api/health",
      "/api/books",
      "/api/conferences",
    ];

    for (const route of publicRoutes) {
      const res = await fetch(`${BASE_URL}${route}`);
      expect(res.status).toBe(200);
    }
  });
});
