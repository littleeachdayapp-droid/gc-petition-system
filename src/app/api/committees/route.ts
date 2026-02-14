import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const committees = await prisma.committee.findMany({
      include: {
        _count: {
          select: {
            memberships: true,
            assignments: true,
          },
        },
      },
      orderBy: { abbreviation: "asc" },
    });

    return NextResponse.json(committees);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch committees" },
      { status: 500 }
    );
  }
}
