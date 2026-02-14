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

    const petition = await prisma.petition.findUnique({
      where: { id: petitionId },
    });

    if (!petition) {
      return NextResponse.json(
        { error: "Petition not found" },
        { status: 404 }
      );
    }

    if (petition.status !== "SUBMITTED" && petition.status !== "UNDER_REVIEW") {
      return NextResponse.json(
        { error: "Petition must be SUBMITTED or UNDER_REVIEW to assign" },
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

    // Check for existing assignment
    const existing = await prisma.petitionAssignment.findUnique({
      where: {
        petitionId_committeeId: { petitionId, committeeId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Petition is already assigned to this committee" },
        { status: 409 }
      );
    }

    // Create assignment and update status
    const [assignment] = await prisma.$transaction([
      prisma.petitionAssignment.create({
        data: {
          petitionId,
          committeeId,
          status: "PENDING",
        },
        include: {
          committee: { select: { id: true, name: true, abbreviation: true } },
        },
      }),
      prisma.petition.update({
        where: { id: petitionId },
        data: { status: "UNDER_REVIEW" },
      }),
    ]);

    return NextResponse.json(assignment, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to assign petition" },
      { status: 500 }
    );
  }
}
