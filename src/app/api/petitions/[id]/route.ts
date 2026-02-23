import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";

export async function GET(
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
        submitter: { select: { id: true, name: true, email: true } },
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
      },
    });

    if (!petition) {
      return NextResponse.json(
        { error: "Petition not found" },
        { status: 404 }
      );
    }

    // PUBLIC users can only see their own drafts
    if (
      petition.status === "DRAFT" &&
      petition.submitterId !== user.id &&
      !hasMinRole(user.role, "STAFF")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(petition);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch petition" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, summary, rationale, actionType, targetBook } = body;

    // Use optimistic lock: add status: "DRAFT" to WHERE clause
    // This ensures the update only succeeds if the petition is still DRAFT
    const updated = await prisma.$transaction(async (tx) => {
      const petition = await tx.petition.findUnique({ where: { id } });

      if (!petition) {
        throw new TxError("Petition not found", 404);
      }

      if (petition.status !== "DRAFT") {
        throw new TxError("Only draft petitions can be edited", 400);
      }

      if (petition.submitterId !== user.id && !hasMinRole(user.role, "STAFF")) {
        throw new TxError("Forbidden", 403);
      }

      return tx.petition.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(summary !== undefined && { summary: summary || null }),
          ...(rationale !== undefined && { rationale: rationale || null }),
          ...(actionType !== undefined && { actionType }),
          ...(targetBook !== undefined && { targetBook }),
        },
        include: {
          submitter: { select: { id: true, name: true } },
          conference: { select: { id: true, name: true, year: true } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TxError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to update petition" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
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
        { error: "Only draft petitions can be deleted" },
        { status: 400 }
      );
    }

    if (petition.submitterId !== user.id && !hasMinRole(user.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.petition.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete petition" },
      { status: 500 }
    );
  }
}

class TxError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}
