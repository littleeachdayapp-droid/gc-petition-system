import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { UserRole } from "@prisma/client";

const VALID_ROLES: UserRole[] = [
  "PUBLIC",
  "DELEGATE",
  "COMMITTEE_MEMBER",
  "COMMITTEE_CHAIR",
  "STAFF",
  "ADMIN",
  "SUPER_ADMIN",
];

export async function PATCH(
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

    // Build update data
    const data: Record<string, unknown> = {};

    if (body.role) {
      if (!VALID_ROLES.includes(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      // Only SUPER_ADMIN can assign SUPER_ADMIN
      if (body.role === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "Only super admins can assign super admin role" },
          { status: 403 }
        );
      }
      // Can't demote yourself
      if (userId === user.id) {
        return NextResponse.json(
          { error: "You cannot change your own role" },
          { status: 400 }
        );
      }
      data.role = body.role;
    }

    if (body.delegationConference !== undefined) {
      data.delegationConference = body.delegationConference || null;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        delegationConference: true,
      },
    data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
