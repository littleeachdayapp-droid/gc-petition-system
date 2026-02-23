import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSessionCookie, makeAuthFetch, prisma, BASE_URL } from "../helpers/setup";
import {
  createTestPetition, createTestDelegate, createTestAssignment,
  createTestPlenarySession, cleanupTestData,
} from "../helpers/factories";

describe("Error Paths & Edge Cases", () => {
  let staffFetch: ReturnType<typeof makeAuthFetch>;
  let adminFetch: ReturnType<typeof makeAuthFetch>;
  let delegateFetch: ReturnType<typeof makeAuthFetch>;
  let delegateId: string;

  beforeAll(async () => {
    const staffCookies = await getSessionCookie("staff@gc2028.org");
    staffFetch = makeAuthFetch(staffCookies);

    const adminCookies = await getSessionCookie("admin@gc2028.org");
    adminFetch = makeAuthFetch(adminCookies);

    const delegate = await createTestDelegate({ role: "DELEGATE" });
    delegateId = delegate.id;
    const delegateCookies = await getSessionCookie(delegate.email);
    delegateFetch = makeAuthFetch(delegateCookies);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // --- DELETE assignment success ---

  it("ADMIN can successfully delete an assignment", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, status: "UNDER_REVIEW" });
    const assignment = await createTestAssignment(petition.id);

    const res = await adminFetch(`/api/assignments/${assignment.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify it's actually gone
    const found = await prisma.petitionAssignment.findUnique({ where: { id: assignment.id } });
    expect(found).toBeNull();
  });

  // --- PATCH non-existent plenary session ---

  it("PATCH non-existent plenary session returns 500", async () => {
    const res = await staffFetch("/api/plenary-sessions/nonexistent-session-id", {
      method: "PATCH",
      body: JSON.stringify({ notes: "Updated notes" }),
    });
    expect(res.status).toBe(500);
  });

  // --- DELETE non-existent plenary session ---

  it("DELETE non-existent plenary session returns 500", async () => {
    const res = await adminFetch("/api/plenary-sessions/nonexistent-session-id", {
      method: "DELETE",
    });
    expect(res.status).toBe(500);
  });

  // --- PATCH non-existent user (admin role update) ---

  it("PATCH non-existent user role returns 500", async () => {
    const res = await adminFetch("/api/admin/users/nonexistent-user-id", {
      method: "PATCH",
      body: JSON.stringify({ role: "DELEGATE" }),
    });
    expect(res.status).toBe(500);
  });

  // --- POST committee membership with non-existent committeeId ---

  it("POST committee membership with non-existent committeeId returns 500", async () => {
    const user = await createTestDelegate();
    const res = await adminFetch(`/api/admin/users/${user.id}/committees`, {
      method: "POST",
      body: JSON.stringify({ committeeId: "nonexistent-committee-id" }),
    });
    expect(res.status).toBe(500);
  });

  // --- Target with non-existent paragraphId (FK violation) ---

  it("target with non-existent paragraphId returns 500 (FK error)", async () => {
    const petition = await createTestPetition({ submitterId: delegateId, withTarget: false });

    const res = await delegateFetch(`/api/petitions/${petition.id}/targets`, {
      method: "POST",
      body: JSON.stringify({
        targets: [{
          paragraphId: "nonexistent-paragraph-id",
          changeType: "REPLACE_TEXT",
          proposedText: "Test text",
        }],
      }),
    });
    expect(res.status).toBe(500);
  });

  // --- Non-numeric number query param ---

  it("paragraphs with non-numeric number param returns 500 (NaN rejected by Prisma)", async () => {
    const book = await prisma.book.findFirst();
    const res = await fetch(`${BASE_URL}/api/books/${book!.id}/paragraphs?number=abc`);
    // parseInt("abc") → NaN, Prisma rejects NaN in integer field
    expect(res.status).toBe(500);
  });

  // --- Committee assignments with invalid status enum ---

  it("committee assignments with invalid status enum returns 500", async () => {
    const committee = await prisma.committee.findFirst();
    const res = await staffFetch(`/api/committees/${committee!.id}/assignments?status=TOTALLY_INVALID`);
    // Prisma rejects invalid enum values with a validation error
    expect(res.status).toBe(500);
  });

  // --- Admin pipeline with invalid status enum ---

  it("admin pipeline with invalid status enum returns 500", async () => {
    const res = await staffFetch("/api/admin/pipeline?status=TOTALLY_INVALID");
    // Prisma rejects invalid enum values with a validation error
    expect(res.status).toBe(500);
  });

  // --- PATCH petition with explicit null for optional fields ---

  it("PATCH petition with null summary/rationale clears those fields", async () => {
    const petition = await createTestPetition({ submitterId: delegateId });

    // Verify fields have values initially
    const initial = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(initial!.summary).not.toBeNull();
    expect(initial!.rationale).not.toBeNull();

    // PATCH with empty strings (which get converted to null via `|| null`)
    const res = await delegateFetch(`/api/petitions/${petition.id}`, {
      method: "PATCH",
      body: JSON.stringify({ summary: "", rationale: "" }),
    });
    expect(res.status).toBe(200);

    const updated = await prisma.petition.findUnique({ where: { id: petition.id } });
    expect(updated!.summary).toBeNull();
    expect(updated!.rationale).toBeNull();
  });
});
