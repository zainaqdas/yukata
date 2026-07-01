import { syncAccountPosts, syncAllAccounts, listCreatorAccountsSafe } from "@/lib/patreon";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = await listCreatorAccountsSafe();
  return NextResponse.json(accounts);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = body.accountId as string | undefined;

    if (accountId) {
      // Sync single account
      const result = await syncAccountPosts(accountId);
      return NextResponse.json(result);
    } else {
      // Sync all accounts
      const results = await syncAllAccounts();
      return NextResponse.json({ results });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
