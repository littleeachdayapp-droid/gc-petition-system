import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { CommitteeActionType, PetitionStatus } from "@prisma/client";

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
    const { assignmentId, action, votesFor, votesAgainst, votesAbstain, notes } =
      body;

    if (!assignmentId || !action) {
      return NextResponse.json(
        { error: "assignmentId and action are required" },
        { status: 400 }
      );
    }

    const validActions: CommitteeActionType[] = [
      "APPROVE",
      "REJECT",
      "AMEND_AND_APPROVE",
      "DEFER",
      "REFER",
      "NO_ACTION",
    ];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Action must be one of: ${validActions.join(", ")}` },
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

    // Determine petition status based on action
    let petitionStatus: PetitionStatus;
    switch (action) {
      case "APPROVE":
        petitionStatus = "APPROVED_BY_COMMITTEE";
        break;
      case "REJECT":
        petitionStatus = "REJECTED_BY_COMMITTEE";
        break;
      case "AMEND_AND_APPROVE":
        petitionStatus = "AMENDED";
        break;
      case "DEFER":
        petitionStatus = "IN_COMMITTEE";
        break;
      case "REFER":
        petitionStatus = "UNDER_REVIEW";
        break;
      case "NO_ACTION":
        petitionStatus = "REJECTED_BY_COMMITTEE";
        break;
      default:
        petitionStatus = "IN_COMMITTEE";
    }

    // Use interactive transaction to prevent duplicate actions
    const committeeAction = await prisma.$transaction(async (tx) => {
      // Re-verify assignment inside transaction
      const assignment = await tx.petitionAssignment.findUnique({
        where: { id: assignmentId },
        include: { petition: true },
      });

      if (!assignment || assignment.committeeId !== committeeId) {
        throw new TxError("Assignment not found for this committee", 404);
      }

      // Check if a final action already exists for this assignment
      const existingAction = await tx.committeeAction.findFirst({
        where: {
          assignmentId,
          action: { in: ["APPROVE", "REJECT", "AMEND_AND_APPROVE", "NO_ACTION"] },
        },
      });

      if (existingAction) {
        throw new TxError("A final action has already been recorded for this assignment", 409);
      }

      const created = await tx.committeeAction.create({
        data: {
          assignmentId,
          committeeId,
          action: action as CommitteeActionType,
          votesFor: votesFor || 0,
          votesAgainst: votesAgainst || 0,
          votesAbstain: votesAbstain || 0,
          notes: notes || null,
        },
      });

      await tx.petitionAssignment.update({
        where: { id: assignmentId },
        data: { status: action === "DEFER" ? "DEFERRED" : "COMPLETED" },
      });

      await tx.petition.update({
        where: { id: assignment.petitionId },
        data: { status: petitionStatus },
      });

      return created;
    });

    return NextResponse.json(committeeAction, { status: 201 });
  } catch (error) {
    if (error instanceof TxError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to record action" },
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
