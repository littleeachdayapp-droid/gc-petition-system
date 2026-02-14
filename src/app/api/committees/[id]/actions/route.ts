import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { CommitteeActionType, PetitionStatus } from "@/generated/prisma/client";

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

    // Verify assignment belongs to this committee
    const assignment = await prisma.petitionAssignment.findUnique({
      where: { id: assignmentId },
      include: { petition: true },
    });

    if (!assignment || assignment.committeeId !== committeeId) {
      return NextResponse.json(
        { error: "Assignment not found for this committee" },
        { status: 404 }
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

    // Create action, update assignment to COMPLETED, update petition status
    const [committeeAction] = await prisma.$transaction([
      prisma.committeeAction.create({
        data: {
          assignmentId,
          committeeId,
          action: action as CommitteeActionType,
          votesFor: votesFor || 0,
          votesAgainst: votesAgainst || 0,
          votesAbstain: votesAbstain || 0,
          notes: notes || null,
        },
      }),
      prisma.petitionAssignment.update({
        where: { id: assignmentId },
        data: { status: action === "DEFER" ? "DEFERRED" : "COMPLETED" },
      }),
      prisma.petition.update({
        where: { id: assignment.petitionId },
        data: { status: petitionStatus },
      }),
    ]);

    return NextResponse.json(committeeAction, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to record action" },
      { status: 500 }
    );
  }
}
