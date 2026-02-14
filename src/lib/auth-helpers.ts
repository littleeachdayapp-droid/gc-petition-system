import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { authOptions } from "./auth";

const ROLE_HIERARCHY: UserRole[] = [
  "PUBLIC",
  "DELEGATE",
  "COMMITTEE_MEMBER",
  "COMMITTEE_CHAIR",
  "STAFF",
  "ADMIN",
  "SUPER_ADMIN",
];

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minRole);
}

export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRole(user.role, allowedRoles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export async function requireMinRole(minRole: UserRole) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasMinRole(user.role, minRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}
