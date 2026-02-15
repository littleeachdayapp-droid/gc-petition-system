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

    const petition = await prisma.petition.findUnique({ where: { id } });

    if (!petition) {
      return NextResponse.json(
        { error: "Petition not found" },
        { status: 404 }
      );
    }

    if (petition.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Targets can only be modified on draft petitions" },
        { status: 400 }
      );
    }

    if (petition.submitterId !== user.id && !hasMinRole(user.role, "STAFF")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    // Replace all existing targets with new ones
    await prisma.$transaction([
      prisma.petitionTarget.deleteMany({ where: { petitionId: id } }),
      ...targets.map(
        (target: {
          paragraphId?: string;
          resolutionId?: string;
          changeType: ChangeType;
          proposedText?: string;
        }) =>
          prisma.petitionTarget.create({
            data: {
              petitionId: id,
              paragraphId: target.paragraphId || null,
              resolutionId: target.resolutionId || null,
              changeType: target.changeType,
              proposedText: target.proposedText || null,
            },
          })
      ),
    ]);

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
  } catch {
    return NextResponse.json(
      { error: "Failed to update targets" },
      { status: 500 }
    );
  }
}
