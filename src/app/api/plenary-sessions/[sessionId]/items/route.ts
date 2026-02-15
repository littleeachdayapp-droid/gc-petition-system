import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { CalendarType } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "STAFF")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { sessionId } = await params;
    const body = await request.json();
    const { petitionId, calendarType } = body;

    if (!petitionId || !calendarType) {
      return NextResponse.json(
        { error: "petitionId and calendarType are required" },
        { status: 400 }
      );
    }

    const validTypes: CalendarType[] = ["CONSENT", "REGULAR", "SPECIAL_ORDER"];
    if (!validTypes.includes(calendarType)) {
      return NextResponse.json(
        { error: `calendarType must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await prisma.plenarySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return NextResponse.json(
        { error: "Plenary session not found" },
        { status: 404 }
      );
    }

    // Verify petition exists and is in a valid status for calendar placement
    const petition = await prisma.petition.findUnique({
      where: { id: petitionId },
    });
    if (!petition) {
      return NextResponse.json(
        { error: "Petition not found" },
        { status: 404 }
      );
    }

    const calendarableStatuses = [
      "APPROVED_BY_COMMITTEE",
      "AMENDED",
      "REJECTED_BY_COMMITTEE",
      "ON_CALENDAR",
    ];
    if (!calendarableStatuses.includes(petition.status)) {
      return NextResponse.json(
        {
          error: `Petition must have committee action before being placed on calendar (current status: ${petition.status})`,
        },
        { status: 400 }
      );
    }

    // Check if petition is already on this session's calendar
    const existing = await prisma.calendarItem.findFirst({
      where: { plenarySessionId: sessionId, petitionId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Petition is already on this session's calendar" },
        { status: 409 }
      );
    }

    // Get next order number
    const lastItem = await prisma.calendarItem.findFirst({
      where: { plenarySessionId: sessionId },
      orderBy: { orderNumber: "desc" },
    });
    const nextOrder = (lastItem?.orderNumber || 0) + 1;

    // Create calendar item and update petition status
    const [item] = await prisma.$transaction([
      prisma.calendarItem.create({
        data: {
          plenarySessionId: sessionId,
          petitionId,
          calendarType: calendarType as CalendarType,
          orderNumber: nextOrder,
        },
        include: {
          petition: {
            include: {
              submitter: { select: { id: true, name: true } },
              targets: {
                include: {
                  paragraph: {
                    select: { id: true, number: true, title: true },
                  },
                  resolution: {
                    select: {
                      id: true,
                      resolutionNumber: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
          actions: true,
        },
      }),
      prisma.petition.update({
        where: { id: petitionId },
        data: { status: "ON_CALENDAR" },
      }),
    ]);

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to add petition to calendar" },
      { status: 500 }
    );
  }
}
