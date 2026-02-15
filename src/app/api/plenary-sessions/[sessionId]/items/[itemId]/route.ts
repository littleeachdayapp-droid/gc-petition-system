import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { CalendarType } from "@prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; itemId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "STAFF")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { sessionId, itemId } = await params;
    const body = await request.json();
    const { calendarType, orderNumber } = body;

    const item = await prisma.calendarItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.plenarySessionId !== sessionId) {
      return NextResponse.json(
        { error: "Calendar item not found" },
        { status: 404 }
      );
    }

    const validTypes: CalendarType[] = ["CONSENT", "REGULAR", "SPECIAL_ORDER"];
    if (calendarType && !validTypes.includes(calendarType)) {
      return NextResponse.json(
        { error: `calendarType must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = await prisma.calendarItem.update({
      where: { id: itemId },
      data: {
        ...(calendarType !== undefined && {
          calendarType: calendarType as CalendarType,
        }),
        ...(orderNumber !== undefined && {
          orderNumber: parseInt(orderNumber),
        }),
      },
      include: {
        petition: {
          include: {
            submitter: { select: { id: true, name: true } },
          },
        },
        actions: true,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update calendar item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; itemId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "STAFF")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { sessionId, itemId } = await params;

    const item = await prisma.calendarItem.findUnique({
      where: { id: itemId },
      include: { actions: true },
    });

    if (!item || item.plenarySessionId !== sessionId) {
      return NextResponse.json(
        { error: "Calendar item not found" },
        { status: 404 }
      );
    }

    if (item.actions.length > 0) {
      return NextResponse.json(
        { error: "Cannot remove item that has recorded votes" },
        { status: 400 }
      );
    }

    // Remove from calendar and revert petition status
    await prisma.$transaction([
      prisma.calendarItem.delete({ where: { id: itemId } }),
      prisma.petition.update({
        where: { id: item.petitionId },
        data: { status: "APPROVED_BY_COMMITTEE" },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to remove calendar item" },
      { status: 500 }
    );
  }
}
