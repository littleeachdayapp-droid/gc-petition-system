import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildVersionDiffs, compareVersionTargets } from "@/lib/diff";

interface SnapshotTarget {
  changeType: string;
  proposedText: string | null;
  paragraph?: { number: number; title: string | null; currentText: string } | null;
  resolution?: {
    resolutionNumber: number;
    title: string;
    currentText: string;
  } | null;
}

interface VersionSnapshot {
  targets?: SnapshotTarget[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: petitionId, versionId } = await params;

    // Verify petition is not a draft (public access allowed for non-drafts)
    const petition = await prisma.petition.findUnique({
      where: { id: petitionId },
      select: { status: true },
    });

    if (!petition || petition.status === "DRAFT") {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    const version = await prisma.petitionVersion.findUnique({
      where: { id: versionId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!version || version.petitionId !== petitionId) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    const snapshot = version.snapshotJson as VersionSnapshot;
    const targets = snapshot?.targets || [];

    // Check if caller wants a comparison with a previous version
    const compareWith = request.nextUrl.searchParams.get("compareWith");

    if (compareWith) {
      // Compare with another version
      const otherVersion = await prisma.petitionVersion.findUnique({
        where: { id: compareWith },
      });

      if (!otherVersion || otherVersion.petitionId !== petitionId) {
        return NextResponse.json(
          { error: "Comparison version not found" },
          { status: 404 }
        );
      }

      const otherSnapshot = otherVersion.snapshotJson as VersionSnapshot;
      const otherTargets = otherSnapshot?.targets || [];

      const diffs = compareVersionTargets(otherTargets, targets);

      return NextResponse.json({
        version: {
          id: version.id,
          versionNum: version.versionNum,
          stage: version.stage,
          createdAt: version.createdAt,
          createdBy: version.createdBy,
        },
        compareWith: {
          id: otherVersion.id,
          versionNum: otherVersion.versionNum,
          stage: otherVersion.stage,
        },
        diffs,
      });
    }

    // Default: diff each target's currentText vs proposedText
    const diffs = buildVersionDiffs(targets);

    return NextResponse.json({
      version: {
        id: version.id,
        versionNum: version.versionNum,
        stage: version.stage,
        createdAt: version.createdAt,
        createdBy: version.createdBy,
      },
      diffs,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load version diff" },
      { status: 500 }
    );
  }
}
