import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "STAFF")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: petitionId } = await params;
    const body = await request.json();
    const { committeeId } = body;

    if (!committeeId) {
      return NextResponse.json(
        { error: "committeeId is required" },
        { status: 400 }
      );
    }

    const committee = await prisma.committee.findUnique({
      where: { id: committeeId },
    });

    if (!committee) {
      return NextResponse.json(
        { error: "Committee not found" },
        { status: 404 }
      );
    }

    // Use interactive transaction to prevent TOCTOU on status + duplicate check
    const assignment = await prisma.$transaction(async (tx) => {
      const petition = await tx.petition.findUnique({
        where: { id: petitionId },
      });

      if (!petition) {
        throw new TxError("Petition not found", 404);
      }

      if (petition.status !== "SUBMITTED" && petition.status !== "UNDER_REVIEW") {
        throw new TxError("Petition must be SUBMITTED or UNDER_REVIEW to assign", 400);
      }

      // Check for existing assignment inside transaction
      const existing = await tx.petitionAssignment.findUnique({
        where: {
          petitionId_committeeId: { petitionId, committeeId },
        },
      });

      if (existing) {
        throw new TxError("Petition is already assigned to this committee", 409);
      }

      const created = await tx.petitionAssignment.create({
        data: {
          petitionId,
          committeeId,
          status: "PENDING",
        },
        include: {
          committee: { select: { id: true, name: true, abbreviation: true } },
        },
      });

      await tx.petition.update({
        where: { id: petitionId },
        data: { status: "UNDER_REVIEW" },
      });

      return created;
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if (error instanceof TxError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    // Handle unique constraint violation (P2002) gracefully
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Petition is already assigned to this committee" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to assign petition" },
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
