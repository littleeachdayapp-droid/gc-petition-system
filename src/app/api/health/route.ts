import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { HealthResponse } from "@/types";

export async function GET() {
  try {
    const [books, sections, paragraphs, resolutions, committees, users, conferences] =
      await Promise.all([
        prisma.book.count(),
        prisma.section.count(),
        prisma.paragraph.count(),
        prisma.resolution.count(),
        prisma.committee.count(),
        prisma.user.count(),
        prisma.conference.count(),
      ]);

    const response: HealthResponse = {
      status: "ok",
      database: "connected",
      counts: {
        books,
        sections,
        paragraphs,
        resolutions,
        committees,
        users,
        conferences,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const response: HealthResponse = {
      status: "error",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return NextResponse.json(response, { status: 500 });
  }
}
