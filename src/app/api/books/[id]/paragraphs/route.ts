import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params;
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");
    const search = searchParams.get("search");
    const number = searchParams.get("number");

    const where: Record<string, unknown> = { bookId };

    if (sectionId) {
      where.sectionId = sectionId;
    }

    if (number) {
      where.number = parseInt(number, 10);
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { currentText: { contains: search, mode: "insensitive" } },
      ];
    }

    const paragraphs = await prisma.paragraph.findMany({
      where,
      include: {
        section: { select: { id: true, title: true, level: true } },
      },
      orderBy: { number: "asc" },
    });

    return NextResponse.json(paragraphs);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch paragraphs" },
      { status: 500 }
    );
  }
}
