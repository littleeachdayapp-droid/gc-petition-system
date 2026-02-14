import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        sections: {
          where: { parentId: null },
          orderBy: { sortOrder: "asc" },
          include: {
            children: {
              orderBy: { sortOrder: "asc" },
              include: {
                children: {
                  orderBy: { sortOrder: "asc" },
                  include: {
                    children: {
                      orderBy: { sortOrder: "asc" },
                    },
                  },
                },
              },
            },
            _count: {
              select: {
                paragraphs: true,
                resolutions: true,
              },
            },
          },
        },
        _count: {
          select: {
            paragraphs: true,
            resolutions: true,
          },
        },
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    return NextResponse.json(book);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch book" },
      { status: 500 }
    );
  }
}
