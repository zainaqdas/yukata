import { discoverFollowedCampaigns } from "@/lib/patreon";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const { accountId } = body;

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  try {
    const result = await discoverFollowedCampaigns(accountId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Discovery failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
