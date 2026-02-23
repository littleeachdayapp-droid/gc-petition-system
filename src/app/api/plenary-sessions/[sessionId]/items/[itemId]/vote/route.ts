import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { PlenaryActionType, PetitionStatus } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; itemId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "STAFF")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { sessionId, itemId } = await params;
    const body = await request.json();
    const { action, votesFor, votesAgainst, votesAbstain, notes } = body;

    if (!action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 }
      );
    }

    const validActions: PlenaryActionType[] = [
      "ADOPT",
      "DEFEAT",
      "AMEND",
      "REFER_BACK",
      "TABLE",
      "POSTPONE",
    ];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    // Determine petition status based on action
    let petitionStatus: PetitionStatus;
    switch (action) {
      case "ADOPT":
        petitionStatus = "ADOPTED";
        break;
      case "DEFEAT":
        petitionStatus = "DEFEATED";
        break;
      case "AMEND":
        petitionStatus = "AMENDED";
        break;
      case "REFER_BACK":
        petitionStatus = "IN_COMMITTEE";
        break;
      case "TABLE":
      case "POSTPONE":
        petitionStatus = "ON_CALENDAR";
        break;
      default:
        petitionStatus = "ON_CALENDAR";
    }

    // Use interactive transaction to prevent duplicate votes
    const plenaryAction = await prisma.$transaction(async (tx) => {
      // Verify item belongs to session inside transaction
      const item = await tx.calendarItem.findUnique({
        where: { id: itemId },
        include: { petition: true },
      });

      if (!item || item.plenarySessionId !== sessionId) {
        throw new TxError("Calendar item not found", 404);
      }

      // Check for existing final vote (ADOPT or DEFEAT) to prevent duplicates
      const existingFinalVote = await tx.plenaryAction.findFirst({
        where: {
          calendarItemId: itemId,
          action: { in: ["ADOPT", "DEFEAT"] },
        },
      });

      if (existingFinalVote) {
        throw new TxError("A final vote has already been recorded for this item", 409);
      }

      const created = await tx.plenaryAction.create({
        data: {
          calendarItemId: itemId,
          action: action as PlenaryActionType,
          votesFor: votesFor || 0,
          votesAgainst: votesAgainst || 0,
          votesAbstain: votesAbstain || 0,
          notes: notes || null,
        },
      });

      await tx.petition.update({
        where: { id: item.petitionId },
        data: { status: petitionStatus },
      });

      // If AMEND, also create a PLENARY_AMENDED version
      if (action === "AMEND") {
        const fullPetition = await tx.petition.findUnique({
          where: { id: item.petitionId },
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

        const lastVersion = await tx.petitionVersion.findFirst({
          where: { petitionId: item.petitionId },
          orderBy: { versionNum: "desc" },
        });
        const nextVersionNum = (lastVersion?.versionNum || 0) + 1;

        await tx.petitionVersion.create({
          data: {
            petitionId: item.petitionId,
            versionNum: nextVersionNum,
            stage: "PLENARY_AMENDED",
            snapshotJson: JSON.parse(JSON.stringify(fullPetition)),
            deltaJson: { action: "AMEND", notes: notes || null },
            createdById: user.id,
          },
        });
      }

      return created;
    });

    return NextResponse.json(plenaryAction, { status: 201 });
  } catch (error) {
    if (error instanceof TxError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to record vote" },
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
