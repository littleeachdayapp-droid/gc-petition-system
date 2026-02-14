import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: committeeId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { committeeId };
    if (status) {
      where.status = status;
    }

    const assignments = await prisma.petitionAssignment.findMany({
      where,
      include: {
        petition: {
          include: {
            submitter: { select: { id: true, name: true } },
            targets: {
              include: {
                paragraph: { select: { id: true, number: true, title: true } },
                resolution: {
                  select: { id: true, resolutionNumber: true, title: true },
                },
              },
            },
            _count: { select: { versions: true } },
          },
        },
        actions: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return NextResponse.json(assignments);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}
