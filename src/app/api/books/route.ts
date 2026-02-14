import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const books = await prisma.book.findMany({
      include: {
        _count: {
          select: {
            sections: true,
            paragraphs: true,
            resolutions: true,
          },
        },
      },
      orderBy: { title: "asc" },
    });

    return NextResponse.json(books);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch books" },
      { status: 500 }
    );
  }
}
