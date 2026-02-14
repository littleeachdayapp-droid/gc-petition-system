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

    const petition = await prisma.petition.findUnique({
      where: { id },
      include: {
        targets: true,
        conference: true,
      },
    });

    if (!petition) {
      return NextResponse.json(
        { error: "Petition not found" },
        { status: 404 }
      );
    }

    if (petition.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft petitions can be submitted" },
        { status: 400 }
      );
    }

    if (petition.submitterId !== user.id && !hasMinRole(user.role, "STAFF")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate petition has required content
    if (!petition.title) {
      return NextResponse.json(
        { error: "Petition must have a title" },
        { status: 400 }
      );
    }

    if (petition.targets.length === 0) {
      return NextResponse.json(
        { error: "Petition must have at least one target" },
        { status: 400 }
      );
    }

    // Generate display number: P-{year}-{NNNN}
    const year = petition.conference.year;
    const count = await prisma.petition.count({
      where: {
        conferenceId: petition.conferenceId,
        displayNumber: { not: null },
      },
    });
    const displayNumber = `P-${year}-${String(count + 1).padStart(4, "0")}`;

    // Create version snapshot
    const fullPetition = await prisma.petition.findUnique({
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

    // Submit petition + create version in a transaction
    const [updated] = await prisma.$transaction([
      prisma.petition.update({
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
      }),
      prisma.petitionVersion.create({
        data: {
          petitionId: id,
          versionNum: 1,
          stage: "ORIGINAL",
          snapshotJson: JSON.parse(JSON.stringify(fullPetition)),
          createdById: user.id,
        },
      }),
    ]);

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to submit petition" },
      { status: 500 }
    );
  }
}
