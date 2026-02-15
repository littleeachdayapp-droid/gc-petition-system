import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, PetitionStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const conferenceId = searchParams.get("conferenceId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const sort = searchParams.get("sort") || "newest";

    const where: Prisma.PetitionWhereInput = {
      // Only show non-draft petitions publicly
      status: { not: "DRAFT" },
    };

    if (status) {
      const validStatuses = Object.values(PetitionStatus);
      const statuses = status
        .split(",")
        .filter((s) => validStatuses.includes(s as PetitionStatus)) as PetitionStatus[];
      if (statuses.length > 0) {
        where.status = { in: statuses };
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { displayNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    if (conferenceId) {
      where.conferenceId = conferenceId;
    }

    let orderBy: Prisma.PetitionOrderByWithRelationInput;
    switch (sort) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "title":
        orderBy = { title: "asc" };
        break;
      case "number":
        orderBy = { displayNumber: "asc" };
        break;
      default:
        orderBy = { updatedAt: "desc" };
    }

    const [petitions, total] = await Promise.all([
      prisma.petition.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          submitter: { select: { id: true, name: true } },
          conference: { select: { id: true, name: true, year: true } },
          _count: { select: { targets: true, versions: true } },
        },
      }),
      prisma.petition.count({ where }),
    ]);

    return NextResponse.json({
      petitions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch petitions" },
      { status: 500 }
    );
  }
}
