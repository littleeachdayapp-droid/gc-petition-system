import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      totalPetitions,
      submitted,
      inCommittee,
      onCalendar,
      adopted,
      defeated,
      totalCommittees,
      totalSessions,
    ] = await Promise.all([
      prisma.petition.count({ where: { status: { not: "DRAFT" } } }),
      prisma.petition.count({ where: { status: "SUBMITTED" } }),
      prisma.petition.count({
        where: {
          status: {
            in: ["UNDER_REVIEW", "IN_COMMITTEE", "AMENDED", "APPROVED_BY_COMMITTEE", "REJECTED_BY_COMMITTEE"],
          },
        },
      }),
      prisma.petition.count({ where: { status: "ON_CALENDAR" } }),
      prisma.petition.count({ where: { status: "ADOPTED" } }),
      prisma.petition.count({ where: { status: "DEFEATED" } }),
      prisma.committee.count(),
      prisma.plenarySession.count(),
    ]);

    return NextResponse.json({
      totalPetitions,
      submitted,
      inCommittee,
      onCalendar,
      adopted,
      defeated,
      totalCommittees,
      totalSessions,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
