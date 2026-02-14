import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const mine = searchParams.get("mine");
    const search = searchParams.get("search");
    const conferenceId = searchParams.get("conferenceId");

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (mine === "true") {
      where.submitterId = user.id;
    }

    if (conferenceId) {
      where.conferenceId = conferenceId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { displayNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    // PUBLIC users can only see their own drafts + all submitted/beyond
    if (!hasMinRole(user.role, "DELEGATE")) {
      where.OR = [
        { submitterId: user.id },
        { status: { not: "DRAFT" } },
      ];
    }

    const petitions = await prisma.petition.findMany({
      where,
      include: {
        submitter: { select: { id: true, name: true } },
        conference: { select: { id: true, name: true, year: true } },
        _count: { select: { targets: true, versions: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(petitions);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch petitions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "DELEGATE")) {
      return NextResponse.json(
        { error: "Only delegates and above can create petitions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, summary, rationale, actionType, targetBook, conferenceId } =
      body;

    if (!title || !actionType || !targetBook || !conferenceId) {
      return NextResponse.json(
        {
          error:
            "Title, actionType, targetBook, and conferenceId are required",
        },
        { status: 400 }
      );
    }

    const conference = await prisma.conference.findUnique({
      where: { id: conferenceId },
    });

    if (!conference) {
      return NextResponse.json(
        { error: "Conference not found" },
        { status: 404 }
      );
    }

    const petition = await prisma.petition.create({
      data: {
        title,
        summary: summary || null,
        rationale: rationale || null,
        actionType,
        targetBook,
        submitterId: user.id,
        conferenceId,
        status: "DRAFT",
      },
      include: {
        submitter: { select: { id: true, name: true } },
        conference: { select: { id: true, name: true, year: true } },
      },
    });

    return NextResponse.json(petition, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create petition" },
      { status: 500 }
    );
  }
}
