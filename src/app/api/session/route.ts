import { auth } from "@/lib/auth";
import { savePatreonSessionId, getSyncStatus } from "@/lib/patreon";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const syncState = await getSyncStatus();
  return NextResponse.json({
    hasSession: !!syncState?.patreonSessionId,
    sessionExpiresAt: syncState?.sessionExpiresAt || null,
    sessionStatus: syncState?.status || "idle",
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId } = body;

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  await savePatreonSessionId(sessionId.trim());
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await savePatreonSessionId("");
  return NextResponse.json({ success: true });
}
