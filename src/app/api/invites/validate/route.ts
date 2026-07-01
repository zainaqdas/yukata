import { validateInviteCode, useInviteCode } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const email = searchParams.get("email");

  if (!code) {
    return NextResponse.json({ valid: false, error: "Missing code" });
  }

  const invite = await validateInviteCode(code);
  if (!invite) {
    return NextResponse.json({ valid: false, error: "Invalid or expired invite code" });
  }

  // If email is provided, claim the invite for this email
  if (email) {
    await prisma.inviteCode.update({
      where: { code },
      data: { pendingEmail: email },
    });
  }

  return NextResponse.json({ valid: true });
}
