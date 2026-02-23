import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Perform all checks and mutations inside an interactive transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Re-read petition inside transaction for consistency
      const petition = await tx.petition.findUnique({
        where: { id },
        include: {
          targets: true,
          conference: true,
        },
      });

      if (!petition) {
        throw new TxError("Petition not found", 404);
      }

      if (petition.status !== "DRAFT") {
        throw new TxError("Only draft petitions can be submitted", 400);
      }

      if (petition.submitterId !== user.id && !hasMinRole(user.role, "STAFF")) {
        throw new TxError("Forbidden", 403);
      }

      if (!petition.title) {
        throw new TxError("Petition must have a title", 400);
      }

      if (petition.targets.length === 0) {
        throw new TxError("Petition must have at least one target", 400);
      }

      // Generate display number inside transaction to prevent collisions
      const year = petition.conference.year;
      const count = await tx.petition.count({
        where: {
          conferenceId: petition.conferenceId,
          displayNumber: { not: null },
        },
      });
      const displayNumber = `P-${year}-${String(count + 1).padStart(4, "0")}`;

      // Load full petition for version snapshot
      const fullPetition = await tx.petition.findUnique({
        where: { id },
        include: {
          targets: {
            include: {
              paragraph: {
                select: { number: true, title: true, currentText: true },
              },
              resolution: {
                select: {
                  resolutionNumber: true,
                  title: true,
                  currentText: true,
                },
              },
            },
          },
        },
      });

      // Update petition status and create version
      const result = await tx.petition.update({
        where: { id },
        data: {
          status: "SUBMITTED",
          displayNumber,
        },
        include: {
          submitter: { select: { id: true, name: true } },
          conference: { select: { id: true, name: true, year: true } },
          targets: {
            include: {
              paragraph: {
                select: { id: true, number: true, title: true },
              },
              resolution: {
                select: { id: true, resolutionNumber: true, title: true },
              },
            },
          },
        },
      });

      await tx.petitionVersion.create({
        data: {
          petitionId: id,
          versionNum: 1,
          stage: "ORIGINAL",
          snapshotJson: JSON.parse(JSON.stringify(fullPetition)),
          createdById: user.id,
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TxError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to submit petition" },
      { status: 500 }
    );
  }
}

class TxError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}
