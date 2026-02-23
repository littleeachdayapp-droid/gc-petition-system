import { prisma } from "./setup";
import { hashSync } from "bcryptjs";

const TEST_PREFIX = "__test__";

/**
 * Create a test delegate user with a unique email.
 */
export async function createTestDelegate(overrides: {
  email?: string;
  name?: string;
  role?: "DELEGATE" | "STAFF" | "ADMIN" | "SUPER_ADMIN" | "COMMITTEE_MEMBER";
} = {}) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return prisma.user.create({
    data: {
      email: overrides.email || `${TEST_PREFIX}delegate-${suffix}@gc2028.org`,
      name: overrides.name || `Test Delegate ${suffix}`,
      passwordHash: hashSync("password123", 4),
      role: overrides.role || "DELEGATE",
      delegationConference: "Test Conference",
    },
  });
}

/**
 * Create a test petition in DRAFT status with a target.
 */
export async function createTestPetition(overrides: {
  submitterId?: string;
  status?: string;
  title?: string;
  conferenceId?: string;
  withTarget?: boolean;
} = {}) {
  // Get conference if not provided
  let conferenceId = overrides.conferenceId;
  if (!conferenceId) {
    const conference = await prisma.conference.findFirst({ where: { isActive: true } });
    if (!conference) throw new Error("No active conference");
    conferenceId = conference.id;
  }

  // Get or create submitter
  let submitterId = overrides.submitterId;
  if (!submitterId) {
    const user = await createTestDelegate();
    submitterId = user.id;
  }

  const suffix = Math.random().toString(36).slice(2, 8);

  const petition = await prisma.petition.create({
    data: {
      title: overrides.title || `${TEST_PREFIX}Petition ${suffix}`,
      summary: "Test petition summary",
      rationale: "Test petition rationale",
      status: (overrides.status as never) || "DRAFT",
      actionType: "AMEND",
      targetBook: "DISCIPLINE",
      submitterId,
      conferenceId,
    },
  });

  // Add a target by default
  if (overrides.withTarget !== false) {
    const paragraph = await prisma.paragraph.findFirst();
    if (paragraph) {
      await prisma.petitionTarget.create({
        data: {
          petitionId: petition.id,
          paragraphId: paragraph.id,
          changeType: "REPLACE_TEXT",
          proposedText: "Proposed test amendment text.",
        },
      });
    }
  }

  return petition;
}

/**
 * Create a test petition assignment.
 */
export async function createTestAssignment(petitionId: string, committeeId?: string) {
  if (!committeeId) {
    const committee = await prisma.committee.findFirst();
    if (!committee) throw new Error("No committees found");
    committeeId = committee.id;
  }

  return prisma.petitionAssignment.create({
    data: {
      petitionId,
      committeeId,
      status: "PENDING",
    },
  });
}

/**
 * Create a test plenary session.
 */
export async function createTestPlenarySession() {
  const conference = await prisma.conference.findFirst({ where: { isActive: true } });
  if (!conference) throw new Error("No active conference");

  // Find next available session number
  const lastSession = await prisma.plenarySession.findFirst({
    where: { conferenceId: conference.id },
    orderBy: { sessionNumber: "desc" },
  });

  return prisma.plenarySession.create({
    data: {
      conferenceId: conference.id,
      sessionNumber: (lastSession?.sessionNumber || 0) + 100 + Math.floor(Math.random() * 100),
      date: new Date("2028-05-10"),
      timeBlock: "MORNING",
      notes: "Test session",
    },
  });
}

/**
 * Create a calendar item for a petition on a session.
 */
export async function createTestCalendarItem(petitionId: string, sessionId: string) {
  const lastItem = await prisma.calendarItem.findFirst({
    where: { plenarySessionId: sessionId },
    orderBy: { orderNumber: "desc" },
  });

  return prisma.calendarItem.create({
    data: {
      plenarySessionId: sessionId,
      petitionId,
      calendarType: "REGULAR",
      orderNumber: (lastItem?.orderNumber || 0) + 1,
    },
  });
}

/**
 * Clean up all test data created by factories.
 * Deletes in correct order to respect foreign key constraints.
 */
export async function cleanupTestData() {
  const testPetitionIds = await prisma.petition.findMany({
    where: { title: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  const ids = testPetitionIds.map((p) => p.id);

  if (ids.length > 0) {
    // Delete in FK-safe order: plenary actions → calendar items → committee actions → assignments → versions → targets → petitions
    await prisma.plenaryAction.deleteMany({
      where: { calendarItem: { petitionId: { in: ids } } },
    });
    await prisma.calendarItem.deleteMany({
      where: { petitionId: { in: ids } },
    });
    await prisma.committeeAction.deleteMany({
      where: { assignment: { petitionId: { in: ids } } },
    });
    await prisma.petitionAssignment.deleteMany({
      where: { petitionId: { in: ids } },
    });
    await prisma.petitionVersion.deleteMany({
      where: { petitionId: { in: ids } },
    });
    await prisma.petitionTarget.deleteMany({
      where: { petitionId: { in: ids } },
    });
    await prisma.petition.deleteMany({
      where: { id: { in: ids } },
    });
  }

  // Delete test plenary sessions (with high session numbers)
  await prisma.plenarySession.deleteMany({
    where: { sessionNumber: { gte: 100 } },
  });

  // Delete test users (ignore FK errors from any remaining references)
  try {
    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_PREFIX } },
    });
  } catch {
    // Some test users may still be referenced by data created via API calls;
    // this is harmless — they'll be cleaned up on next run or manually
  }
}
