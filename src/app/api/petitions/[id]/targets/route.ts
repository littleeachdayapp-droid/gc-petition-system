import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { ChangeType } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const body = await request.json();
    const { targets } = body;

    if (!Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { error: "At least one target is required" },
        { status: 400 }
      );
    }

    // Validate each target
    for (const target of targets) {
      if (!target.changeType) {
        return NextResponse.json(
          { error: "Each target must have a changeType" },
          { status: 400 }
        );
      }
      if (!target.paragraphId && !target.resolutionId) {
        return NextResponse.json(
          {
            error:
              "Each target must reference a paragraph or resolution",
          },
          { status: 400 }
        );
      }
    }

    // Use interactive transaction to re-check status before modifying targets
    await prisma.$transaction(async (tx) => {
      const petition = await tx.petition.findUnique({ where: { id } });

      if (!petition) {
        throw new TxError("Petition not found", 404);
      }

      if (petition.status !== "DRAFT") {
        throw new TxError("Targets can only be modified on draft petitions", 400);
      }

      if (petition.submitterId !== user.id && !hasMinRole(user.role, "STAFF")) {
        throw new TxError("Forbidden", 403);
      }

      // Delete existing and create new targets inside the transaction
      await tx.petitionTarget.deleteMany({ where: { petitionId: id } });

      for (const target of targets as Array<{
        paragraphId?: string;
        resolutionId?: string;
        changeType: ChangeType;
        proposedText?: string;
      }>) {
        await tx.petitionTarget.create({
          data: {
            petitionId: id,
            paragraphId: target.paragraphId || null,
            resolutionId: target.resolutionId || null,
            changeType: target.changeType,
            proposedText: target.proposedText || null,
          },
        });
      }
    });

    const updated = await prisma.petitionTarget.findMany({
      where: { petitionId: id },
      include: {
        paragraph: {
          select: { id: true, number: true, title: true },
        },
        resolution: {
          select: { id: true, resolutionNumber: true, title: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TxError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to update targets" },
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
