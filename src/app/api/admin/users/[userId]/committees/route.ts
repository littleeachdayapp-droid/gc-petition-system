import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { CommitteeRole } from "@prisma/client";

const VALID_COMMITTEE_ROLES: CommitteeRole[] = ["CHAIR", "VICE_CHAIR", "SECRETARY", "MEMBER"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasMinRole(user.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();
    const { committeeId, role } = body;

    if (!committeeId) {
      return NextResponse.json({ error: "committeeId is required" }, { status: 400 });
    }

    const committeeRole = VALID_COMMITTEE_ROLES.includes(role) ? role : "MEMBER";

    // Check if already a member
    const existing = await prisma.committeeMembership.findUnique({
      where: { userId_committeeId: { userId, committeeId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User is already a member of this committee" },
        { status: 409 }
      );
    }

    const membership = await prisma.committeeMembership.create({
      data: { userId, committeeId, role: committeeRole },
      include: {
        committee: { select: { id: true, name: true, abbreviation: true } },
      },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to add committee membership" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasMinRole(user.role, "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get("membershipId");

    if (!membershipId) {
      return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
    }

    // Verify membership belongs to this user
    const membership = await prisma.committeeMembership.findFirst({
      where: { id: membershipId, userId },
    });

    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    await prisma.committeeMembership.delete({ where: { id: membershipId } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to remove committee membership" },
      { status: 500 }
    );
  }
}
