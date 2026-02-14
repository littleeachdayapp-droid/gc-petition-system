/**
 * Committee auto-routing logic.
 * Given a petition's target paragraphs/resolutions, determines which committee(s)
 * should handle it based on routing rules.
 */

import { prisma } from "./prisma";

export interface RoutingRules {
  paragraphRanges: Array<{ from: number; to: number }>;
  resolutionRanges: Array<{ from: number; to: number }>;
  tags: string[];
}

export interface CommitteeWithRules {
  id: string;
  abbreviation: string;
  rules: RoutingRules;
}

export function isInRange(
  value: number,
  ranges: Array<{ from: number; to: number }>
): boolean {
  return ranges.some((r) => value >= r.from && value <= r.to);
}

/**
 * Returns all committee abbreviations whose paragraph ranges match the given number.
 */
export function routeParagraph(
  paragraphNumber: number,
  committeeRules: CommitteeWithRules[]
): string[] {
  return committeeRules
    .filter((c) => isInRange(paragraphNumber, c.rules.paragraphRanges))
    .map((c) => c.abbreviation);
}

/**
 * Returns all committee abbreviations whose resolution ranges match the given number.
 */
export function routeResolution(
  resolutionNumber: number,
  committeeRules: CommitteeWithRules[]
): string[] {
  return committeeRules
    .filter((c) => isInRange(resolutionNumber, c.rules.resolutionRanges))
    .map((c) => c.abbreviation);
}

/**
 * Returns all committee abbreviations whose tags overlap with the given tags.
 */
export function routeByTags(
  tags: string[],
  committeeRules: CommitteeWithRules[]
): string[] {
  if (tags.length === 0) return [];
  return committeeRules
    .filter((c) => c.rules.tags.some((t) => tags.includes(t)))
    .map((c) => c.abbreviation);
}

/**
 * Auto-route a petition to matching committees based on its targets.
 * Returns the created assignment IDs.
 *
 * Algorithm:
 * 1. Load all committees with routing rules
 * 2. For each petition target, match against paragraph/resolution ranges
 * 3. Fall back to tag-based matching if no range matches
 * 4. Deduplicate and create PetitionAssignment for each matching committee
 * 5. Update petition status to UNDER_REVIEW
 */
export async function autoRoutePetition(petitionId: string) {
  const petition = await prisma.petition.findUnique({
    where: { id: petitionId },
    include: {
      targets: {
        include: {
          paragraph: { select: { number: true, categoryTags: true } },
          resolution: { select: { resolutionNumber: true, topicGroup: true } },
        },
      },
    },
  });

  if (!petition) throw new Error("Petition not found");
  if (petition.status !== "SUBMITTED") {
    throw new Error("Only SUBMITTED petitions can be routed");
  }

  // Load all committees with routing rules
  const committees = await prisma.committee.findMany();
  const committeeRules: CommitteeWithRules[] = committees.map((c) => ({
    id: c.id,
    abbreviation: c.abbreviation,
    rules: c.routingRulesJson as unknown as RoutingRules,
  }));

  // Find matching committees
  const matchedAbbreviations = new Set<string>();

  for (const target of petition.targets) {
    if (target.paragraph) {
      const matches = routeParagraph(target.paragraph.number, committeeRules);
      matches.forEach((m) => matchedAbbreviations.add(m));

      // Tag fallback if no range match
      if (matches.length === 0 && target.paragraph.categoryTags.length > 0) {
        const tagMatches = routeByTags(
          target.paragraph.categoryTags,
          committeeRules
        );
        tagMatches.forEach((m) => matchedAbbreviations.add(m));
      }
    }

    if (target.resolution) {
      const matches = routeResolution(
        target.resolution.resolutionNumber,
        committeeRules
      );
      matches.forEach((m) => matchedAbbreviations.add(m));
    }
  }

  // Look up committee IDs for matched abbreviations
  const matchedCommittees = committees.filter((c) =>
    matchedAbbreviations.has(c.abbreviation)
  );

  // Check for existing assignments to avoid duplicates
  const existingAssignments = await prisma.petitionAssignment.findMany({
    where: { petitionId },
    select: { committeeId: true },
  });
  const existingIds = new Set(existingAssignments.map((a) => a.committeeId));

  const newCommittees = matchedCommittees.filter(
    (c) => !existingIds.has(c.id)
  );

  // Create assignments and update status in a transaction
  const result = await prisma.$transaction([
    ...newCommittees.map((c) =>
      prisma.petitionAssignment.create({
        data: {
          petitionId,
          committeeId: c.id,
          status: "PENDING",
        },
      })
    ),
    prisma.petition.update({
      where: { id: petitionId },
      data: { status: "UNDER_REVIEW" },
    }),
  ]);

  return {
    assignedTo: matchedCommittees.map((c) => c.abbreviation),
    newAssignments: newCommittees.length,
    petitionStatus: "UNDER_REVIEW",
    // Last element is the updated petition
    petition: result[result.length - 1],
  };
}
