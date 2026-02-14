import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    const session = await prisma.plenarySession.findUnique({
      where: { id: sessionId },
      include: {
        conference: { select: { id: true, name: true, year: true } },
        items: {
          orderBy: { orderNumber: "asc" },
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
            actions: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Plenary session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch plenary session" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { date, timeBlock, notes } = body;

    const session = await prisma.plenarySession.update({
      where: { id: sessionId },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(timeBlock !== undefined && { timeBlock }),
        ...(notes !== undefined && { notes: notes || null }),
      },
      include: {
        conference: { select: { id: true, name: true, year: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json(session);
  } catch {
    return NextResponse.json(
      { error: "Failed to update plenary session" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { sessionId } = await params;

    await prisma.plenarySession.delete({ where: { id: sessionId } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete plenary session" },
      { status: 500 }
    );
  }
}
