import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const conferences = await prisma.conference.findMany({
      orderBy: { year: "desc" },
    });
    return NextResponse.json(conferences);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch conferences" },
      { status: 500 }
    );
  }
}
