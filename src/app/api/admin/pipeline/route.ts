import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "STAFF")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    } else {
      // Default: show actionable statuses
      where.status = {
        in: [
          "SUBMITTED",
          "UNDER_REVIEW",
          "IN_COMMITTEE",
          "AMENDED",
          "APPROVED_BY_COMMITTEE",
          "REJECTED_BY_COMMITTEE",
        ],
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { displayNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const petitions = await prisma.petition.findMany({
      where,
      include: {
        submitter: { select: { id: true, name: true } },
        conference: { select: { id: true, name: true, year: true } },
        assignments: {
          include: {
            committee: {
              select: { id: true, name: true, abbreviation: true },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
        _count: { select: { targets: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(petitions);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch pipeline" },
      { status: 500 }
    );
  }
}
