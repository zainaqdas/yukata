import { auth } from "@/lib/auth";
import { createInviteCode, listInviteCodes, deactivateInviteCode } from "@/lib/invites";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const codes = await listInviteCodes();
  return NextResponse.json(codes);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { maxUses, note, expiresInDays } = body;

  const invite = await createInviteCode(
    maxUses || 100,
    note,
    expiresInDays
  );

  return NextResponse.json(invite, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  await deactivateInviteCode(code);
  return NextResponse.json({ success: true });
}
