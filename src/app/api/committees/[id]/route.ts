import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

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

    const committee = await prisma.committee.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { role: "asc" },
        },
        _count: {
          select: { assignments: true, actions: true },
        },
      },
    });

    if (!committee) {
      return NextResponse.json(
        { error: "Committee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(committee);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch committee" },
      { status: 500 }
    );
  }
}
