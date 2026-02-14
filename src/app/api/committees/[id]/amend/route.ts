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

    // Load full petition for snapshot
    const petition = await prisma.petition.findUnique({
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
      return NextResponse.json(
        { error: "Petition not found" },
        { status: 404 }
      );
    }

    // Get next version number
    const lastVersion = await prisma.petitionVersion.findFirst({
      where: { petitionId },
      orderBy: { versionNum: "desc" },
    });
    const nextVersionNum = (lastVersion?.versionNum || 0) + 1;

    // Create amended version and update petition status
    const [version] = await prisma.$transaction([
      prisma.petitionVersion.create({
        data: {
          petitionId,
          versionNum: nextVersionNum,
          stage: "COMMITTEE_AMENDED",
          snapshotJson: JSON.parse(JSON.stringify(petition)),
          deltaJson: amendedTargets,
          createdById: user.id,
        },
      }),
      prisma.petition.update({
        where: { id: petitionId },
        data: { status: "AMENDED" },
      }),
    ]);

    return NextResponse.json(version, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create amendment" },
      { status: 500 }
    );
  }
}
