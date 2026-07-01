import { createAccount, deleteAccount, listCreatorAccounts } from "@/lib/patreon";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = await listCreatorAccounts();
  return NextResponse.json(accounts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, campaignId } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Account name is required" }, { status: 400 });
  }

  const account = await createAccount(name.trim(), campaignId);
  return NextResponse.json(account);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("id");

  if (!accountId) {
    return NextResponse.json({ error: "Account id is required" }, { status: 400 });
  }

  await deleteAccount(accountId);
  return NextResponse.json({ success: true });
}
