import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { PlenaryActionType, PetitionStatus, Prisma } from "@/generated/prisma/client";

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

    // Verify item belongs to session
    const item = await prisma.calendarItem.findUnique({
      where: { id: itemId },
      include: { petition: true },
    });

    if (!item || item.plenarySessionId !== sessionId) {
      return NextResponse.json(
        { error: "Calendar item not found" },
        { status: 404 }
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

    // Create action and update petition status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transactions: Prisma.PrismaPromise<any>[] = [
      prisma.plenaryAction.create({
        data: {
          calendarItemId: itemId,
          action: action as PlenaryActionType,
          votesFor: votesFor || 0,
          votesAgainst: votesAgainst || 0,
          votesAbstain: votesAbstain || 0,
          notes: notes || null,
        },
      }),
      prisma.petition.update({
        where: { id: item.petitionId },
        data: { status: petitionStatus },
      }),
    ];

    // If AMEND, also create a PLENARY_AMENDED version
    if (action === "AMEND") {
      const fullPetition = await prisma.petition.findUnique({
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

      const lastVersion = await prisma.petitionVersion.findFirst({
        where: { petitionId: item.petitionId },
        orderBy: { versionNum: "desc" },
      });
      const nextVersionNum = (lastVersion?.versionNum || 0) + 1;

      transactions.push(
        prisma.petitionVersion.create({
          data: {
            petitionId: item.petitionId,
            versionNum: nextVersionNum,
            stage: "PLENARY_AMENDED",
            snapshotJson: JSON.parse(JSON.stringify(fullPetition)),
            deltaJson: { action: "AMEND", notes: notes || null },
            createdById: user.id,
          },
        })
      );
    }

    const [plenaryAction] = await prisma.$transaction(transactions);

    return NextResponse.json(plenaryAction, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to record vote" },
      { status: 500 }
    );
  }
}
