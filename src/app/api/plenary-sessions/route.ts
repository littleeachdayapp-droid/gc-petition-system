import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conferenceId = request.nextUrl.searchParams.get("conferenceId");

    const sessions = await prisma.plenarySession.findMany({
      where: conferenceId ? { conferenceId } : undefined,
      include: {
        conference: { select: { id: true, name: true, year: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ date: "asc" }, { sessionNumber: "asc" }],
    });

    return NextResponse.json(sessions);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch plenary sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "STAFF")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { conferenceId, sessionNumber, date, timeBlock, notes } = body;

    if (!conferenceId || !sessionNumber || !date || !timeBlock) {
      return NextResponse.json(
        {
          error:
            "conferenceId, sessionNumber, date, and timeBlock are required",
        },
        { status: 400 }
      );
    }

    const validTimeBlocks = ["MORNING", "AFTERNOON", "EVENING"];
    if (!validTimeBlocks.includes(timeBlock)) {
      return NextResponse.json(
        { error: `timeBlock must be one of: ${validTimeBlocks.join(", ")}` },
        { status: 400 }
      );
    }

    const session = await prisma.plenarySession.create({
      data: {
        conferenceId,
        sessionNumber: parseInt(sessionNumber),
        date: new Date(date),
        timeBlock,
        notes: notes || null,
      },
      include: {
        conference: { select: { id: true, name: true, year: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create plenary session" },
      { status: 500 }
    );
  }
}
