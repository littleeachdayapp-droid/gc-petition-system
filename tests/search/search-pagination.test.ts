import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import { createTestPetition, createTestDelegate, cleanupTestData } from "../helpers/factories";

describe("Search, Filtering & Pagination", () => {
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;

  beforeAll(async () => {
    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    const cookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(cookies);

    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    // Create some test petitions for search tests
    await createTestPetition({ submitterId: delegateId, status: "SUBMITTED", title: "__test__SearchUniqueAlpha" });
    await createTestPetition({ submitterId: delegateId, status: "SUBMITTED", title: "__test__SearchUniqueBeta" });
    await createTestPetition({ submitterId: delegateId, status: "ADOPTED", title: "__test__AdoptedPetition" });
    await createTestPetition({ submitterId: delegateId, status: "DEFEATED", title: "__test__DefeatedPetition" });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- Authenticated Search ---

  it("searches petitions by title (case-insensitive)", async () => {
    const res = await staffFetch("/api/petitions?search=searchuniquealpha");
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.some((p: { title: string }) => p.title.includes("SearchUniqueAlpha"));
    expect(found).toBe(true);
  });

  it("filters petitions by status", async () => {
    const res = await staffFetch("/api/petitions?status=SUBMITTED");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((p: { status: string }) => p.status === "SUBMITTED")).toBe(true);
  });

  it("filters my petitions with mine=true", async () => {
    const res = await delegateFetch("/api/petitions?mine=true");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((p: { submitter: { id: string } }) => p.submitter.id === delegateId)).toBe(true);
  });

  it("DRAFT visibility: non-STAFF sees only own DRAFTs", async () => {
    // Create a DRAFT by a different user
    const other = await createTestDelegate();
    await createTestPetition({ submitterId: other.id, status: "DRAFT", title: "__test__OtherDraft" });

    const res = await delegateFetch("/api/petitions?status=DRAFT");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Should not contain other user's draft
    const hasOtherDraft = body.some((p: { title: string }) => p.title.includes("OtherDraft"));
    expect(hasOtherDraft).toBe(false);
  });

  it("handles special characters in search safely", async () => {
    const res = await staffFetch("/api/petitions?search=$.*%5B%5D");
    expect(res.status).toBe(200);
  });

  // --- Public Search ---

  it("public search excludes DRAFT petitions", async () => {
    await createTestPetition({ submitterId: delegateId, status: "DRAFT", title: "__test__PublicHiddenDraft" });

    const res = await fetch(`${BASE_URL}/api/public/petitions?search=PublicHiddenDraft`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.petitions.length).toBe(0);
  });

  it("public search returns pagination metadata", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?page=1&limit=5`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(5);
    expect(typeof body.pagination.total).toBe("number");
    expect(typeof body.pagination.totalPages).toBe("number");
  });

  it("public search clamps limit to 100", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?limit=1000`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination.limit).toBe(100);
  });

  it("public search sorts by newest (default)", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?limit=5`);
    expect(res.status).toBe(200);
    const body = await res.json();
    if (body.petitions.length >= 2) {
      const dates = body.petitions.map((p: { updatedAt: string }) => new Date(p.updatedAt).getTime());
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
    }
  });

  it("public search sorts by title", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?sort=title&limit=5`);
    expect(res.status).toBe(200);
    const body = await res.json();
    if (body.petitions.length >= 2) {
      const titles = body.petitions.map((p: { title: string }) => p.title);
      const sorted = [...titles].sort();
      expect(titles).toEqual(sorted);
    }
  });

  it("public search filters by status", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?status=ADOPTED`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.petitions.every((p: { status: string }) => p.status === "ADOPTED")).toBe(true);
  });

  it("public search handles invalid status gracefully", async () => {
    const res = await fetch(`${BASE_URL}/api/public/petitions?status=INVALID_STATUS`);
    expect(res.status).toBe(200);
    // Invalid status is filtered out, query falls back to default (not DRAFT)
  });

  it("public pagination page 2 skips page 1 results", async () => {
    const res1 = await fetch(`${BASE_URL}/api/public/petitions?page=1&limit=2`);
    const body1 = await res1.json();

    const res2 = await fetch(`${BASE_URL}/api/public/petitions?page=2&limit=2`);
    const body2 = await res2.json();

    if (body1.petitions.length > 0 && body2.petitions.length > 0) {
      const page1Ids = body1.petitions.map((p: { id: string }) => p.id);
      const page2Ids = body2.petitions.map((p: { id: string }) => p.id);
      // No overlap between pages
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    }
  });

  // --- Admin Pipeline ---

  it("admin pipeline returns petitions (STAFF access)", async () => {
    const res = await staffFetch("/api/admin/pipeline");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("admin pipeline filters by search", async () => {
    const res = await staffFetch("/api/admin/pipeline?search=SearchUniqueAlpha");
    expect(res.status).toBe(200);
    const body = await res.json();
    if (body.length > 0) {
      const found = body.some((p: { title: string }) =>
        p.title.toLowerCase().includes("searchuniquealpha")
      );
      expect(found).toBe(true);
    }
  });

  // --- Results ---

  it("results endpoint returns adopted filter", async () => {
    const res = await fetch(`${BASE_URL}/api/public/results?outcome=adopted`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.petitions.every((p: { status: string }) => p.status === "ADOPTED")).toBe(true);
  });

  it("results endpoint returns defeated filter", async () => {
    const res = await fetch(`${BASE_URL}/api/public/results?outcome=defeated`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.petitions.every((p: { status: string }) => p.status === "DEFEATED")).toBe(true);
  });

  it("results endpoint returns summary counts", async () => {
    const res = await fetch(`${BASE_URL}/api/public/results`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.adopted).toBe("number");
    expect(typeof body.summary.defeated).toBe("number");
  });
});
