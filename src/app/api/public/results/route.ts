import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const outcome = searchParams.get("outcome"); // "adopted" | "defeated" | all
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    const statusFilter =
      outcome === "adopted"
        ? ["ADOPTED"]
        : outcome === "defeated"
          ? ["DEFEATED"]
          : ["ADOPTED", "DEFEATED"];

    const where = {
      status: { in: statusFilter as ("ADOPTED" | "DEFEATED")[] },
    };

    const [petitions, total, adoptedCount, defeatedCount] = await Promise.all([
      prisma.petition.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          submitter: { select: { id: true, name: true } },
          conference: { select: { id: true, name: true, year: true } },
          _count: { select: { targets: true } },
          calendarItems: {
            include: {
              actions: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
          assignments: {
            include: {
              committee: {
                select: { name: true, abbreviation: true },
              },
              actions: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.petition.count({ where }),
      prisma.petition.count({ where: { status: "ADOPTED" } }),
      prisma.petition.count({ where: { status: "DEFEATED" } }),
    ]);

    return NextResponse.json({
      petitions,
      summary: { adopted: adoptedCount, defeated: defeatedCount },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
