import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export async function createInviteCode(
  maxUses = 100,
  note?: string,
  expiresInDays?: number
) {
  const code = uuidv4().slice(0, 12).toUpperCase();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  return prisma.inviteCode.create({
    data: {
      code,
      maxUses,
      note,
      expiresAt,
    },
  });
}

export async function validateInviteCode(code: string) {
  const inviteCode = await prisma.inviteCode.findUnique({
    where: { code },
  });

  if (!inviteCode || !inviteCode.isActive) return null;
  if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) return null;
  if (inviteCode.currentUses >= inviteCode.maxUses) return null;

  return inviteCode;
}

export async function useInviteCode(code: string) {
  return prisma.inviteCode.update({
    where: { code },
    data: { currentUses: { increment: 1 } },
  });
}

export async function listInviteCodes() {
  return prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { users: { select: { email: true, createdAt: true } } },
  });
}

export async function deactivateInviteCode(code: string) {
  return prisma.inviteCode.update({
    where: { code },
    data: { isActive: false },
  });
}
