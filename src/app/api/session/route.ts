import { savePatreonSessionId, getSyncStatus } from "@/lib/patreon";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const syncState = await getSyncStatus(accountId);
  if (!syncState) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({
    hasSession: !!syncState.patreonSessionId,
    sessionExpiresAt: syncState.sessionExpiresAt || null,
    sessionStatus: syncState.status || "idle",
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { accountId, sessionId } = body;

  if (!accountId || !sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { error: "accountId and sessionId are required" },
      { status: 400 }
    );
  }

  await savePatreonSessionId(accountId, sessionId.trim());
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  await savePatreonSessionId(accountId, "");
  return NextResponse.json({ success: true });
}
