import { NextResponse } from "next/server";
import { getCurrentUser, hasMinRole } from "@/lib/auth-helpers";
import { autoRoutePetition } from "@/lib/routing";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(user.role, "STAFF")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const result = await autoRoutePetition(id);

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to route petition";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
