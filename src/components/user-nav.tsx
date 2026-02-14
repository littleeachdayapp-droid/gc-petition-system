"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { UserRole } from "@/generated/prisma/client";

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STAFF: "Staff",
  COMMITTEE_CHAIR: "Committee Chair",
  COMMITTEE_MEMBER: "Committee Member",
  DELEGATE: "Delegate",
  PUBLIC: "Public",
};

export function UserNav() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="text-sm text-gray-400">...</div>;
  }

  if (!session?.user) {
    return (
      <Link href="/login" className="text-gray-600 hover:text-gray-900">
        Sign In
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="text-sm text-right">
        <div className="font-medium text-gray-900">{session.user.name}</div>
        <div className="text-gray-500">{ROLE_LABELS[session.user.role]}</div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-3 py-1"
      >
        Sign Out
      </button>
    </div>
  );
}
