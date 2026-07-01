import { syncAccountPosts, syncAllAccounts, listCreatorAccounts } from "@/lib/patreon";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = await listCreatorAccounts();
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Sync failed" },
      { status: 500 }
    );
  }
}
