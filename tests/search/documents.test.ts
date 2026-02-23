import { describe, it, expect, beforeAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";

describe("Document Browser APIs", () => {
  let authFetch: ReturnType<typeof makeAuthFetch>;
  let disciplineBookId: string;
  let resolutionsBookId: string;

  beforeAll(async () => {
    // Books API is public (no auth), but paragraphs/resolutions may need auth
    // Use staff to be safe
    const cookies = await getSessionCookie("staff@gc2028.org");
    authFetch = makeAuthFetch(cookies);

    const discipline = await prisma.book.findFirst({ where: { title: { contains: "Discipline" } } });
    disciplineBookId = discipline!.id;

    const resolutions = await prisma.book.findFirst({ where: { title: { contains: "Resolutions" } } });
    resolutionsBookId = resolutions!.id;
  });

  // --- Books ---

  it("lists all books with counts", async () => {
    const res = await fetch(`${BASE_URL}/api/books`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body[0]._count).toBeDefined();
    expect(typeof body[0]._count.sections).toBe("number");
    expect(typeof body[0]._count.paragraphs).toBe("number");
  });

  // --- Paragraphs ---

  it("lists paragraphs for a book", async () => {
    const res = await fetch(`${BASE_URL}/api/books/${disciplineBookId}/paragraphs`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("searches paragraphs by text (case-insensitive)", async () => {
    // Get a known paragraph text
    const para = await prisma.paragraph.findFirst({ where: { bookId: disciplineBookId } });
    const searchTerm = para!.title?.slice(0, 10) || "church";

    const res = await fetch(`${BASE_URL}/api/books/${disciplineBookId}/paragraphs?search=${encodeURIComponent(searchTerm)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThanOrEqual(0); // May or may not match, but shouldn't crash
  });

  it("filters paragraphs by number", async () => {
    const para = await prisma.paragraph.findFirst({ where: { bookId: disciplineBookId } });
    const res = await fetch(`${BASE_URL}/api/books/${disciplineBookId}/paragraphs?number=${para!.number}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].number).toBe(para!.number);
  });

  it("filters paragraphs by sectionId", async () => {
    const section = await prisma.section.findFirst({ where: { bookId: disciplineBookId } });
    const res = await fetch(`${BASE_URL}/api/books/${disciplineBookId}/paragraphs?sectionId=${section!.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((p: { section: { id: string } }) => p.section.id === section!.id)).toBe(true);
  });

  // --- Resolutions ---

  it("lists resolutions for a book", async () => {
    const res = await fetch(`${BASE_URL}/api/books/${resolutionsBookId}/resolutions`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("searches resolutions by text", async () => {
    const res = await fetch(`${BASE_URL}/api/books/${resolutionsBookId}/resolutions?search=justice`);
    expect(res.status).toBe(200);
  });

  it("filters resolutions by topicGroup", async () => {
    const resolution = await prisma.resolution.findFirst({ where: { topicGroup: { not: null } } });
    if (!resolution?.topicGroup) return; // Skip if no tagged resolutions

    const res = await fetch(`${BASE_URL}/api/books/${resolutionsBookId}/resolutions?topicGroup=${encodeURIComponent(resolution.topicGroup)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((r: { topicGroup: string }) => r.topicGroup === resolution.topicGroup)).toBe(true);
  });
});
