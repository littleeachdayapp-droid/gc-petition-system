import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const petition = await prisma.petition.findUnique({
      where: { id },
      include: {
        submitter: { select: { id: true, name: true } },
        conference: { select: { id: true, name: true, year: true } },
        targets: {
          include: {
            paragraph: {
              select: { id: true, number: true, title: true, currentText: true },
            },
            resolution: {
              select: {
                id: true,
                resolutionNumber: true,
                title: true,
                currentText: true,
              },
            },
          },
        },
        versions: {
          orderBy: { versionNum: "desc" },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        },
        assignments: {
          include: {
            committee: {
              select: { id: true, name: true, abbreviation: true },
            },
            actions: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
        calendarItems: {
          include: {
            plenarySession: {
              select: {
                id: true,
                sessionNumber: true,
                date: true,
                timeBlock: true,
              },
            },
            actions: {
              orderBy: { createdAt: "desc" },
              take: 1,
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

    // Don't expose drafts publicly
    if (petition.status === "DRAFT") {
      return NextResponse.json(
        { error: "Petition not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(petition);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch petition" },
      { status: 500 }
    );
  }
}
