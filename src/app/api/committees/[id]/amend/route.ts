import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "COMMITTEE_MEMBER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: committeeId } = await params;
    const body = await request.json();
    const { petitionId, amendedTargets } = body;

    if (!petitionId || !amendedTargets) {
      return NextResponse.json(
        { error: "petitionId and amendedTargets are required" },
        { status: 400 }
      );
    }

    // Verify user is a member of this committee (or STAFF+)
    if (!hasMinRole(user.role, "STAFF")) {
      const membership = await prisma.committeeMembership.findUnique({
        where: {
          userId_committeeId: { userId: user.id, committeeId },
        },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "You are not a member of this committee" },
          { status: 403 }
        );
      }
    }

    // Use interactive transaction to prevent version number collisions
    const version = await prisma.$transaction(async (tx) => {
      // Load full petition for snapshot inside transaction
      const petition = await tx.petition.findUnique({
        where: { id: petitionId },
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

      if (!petition) {
        throw new TxError("Petition not found", 404);
      }

      // Get next version number inside transaction
      const lastVersion = await tx.petitionVersion.findFirst({
        where: { petitionId },
        orderBy: { versionNum: "desc" },
      });
      const nextVersionNum = (lastVersion?.versionNum || 0) + 1;

      const created = await tx.petitionVersion.create({
        data: {
          petitionId,
          versionNum: nextVersionNum,
          stage: "COMMITTEE_AMENDED",
          snapshotJson: JSON.parse(JSON.stringify(petition)),
          deltaJson: amendedTargets,
          createdById: user.id,
        },
      });

      await tx.petition.update({
        where: { id: petitionId },
        data: { status: "AMENDED" },
      });

      return created;
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    if (error instanceof TxError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to create amendment" },
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
