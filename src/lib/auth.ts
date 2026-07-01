import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { useInviteCode } from "@/lib/invites";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
        include: { inviteCode: true },
      });

      // If user already has an invite code linked, allow sign in
      if (existingUser?.inviteCodeId) return true;

      // Check for a pending invite claim for this email
      const pendingInvite = await prisma.inviteCode.findFirst({
        where: {
          pendingEmail: user.email,
          isActive: true,
          currentUses: { lt: 100 }, // Will be checked again in claim
        },
      });

      if (pendingInvite) {
        // Link the invite code to the user and increment usage
        try {
          // If user exists, link them
          if (existingUser) {
            await useInviteCode(pendingInvite.code);
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { inviteCodeId: pendingInvite.id },
            });
            await prisma.inviteCode.update({
              where: { id: pendingInvite.id },
              data: { pendingEmail: null },
            });
          }
        } catch {
          // If claiming fails, still allow sign-in
        }
      }

      return true;
    },

    async session({ session, user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true },
      });

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          role: dbUser?.role ?? "MEMBER",
        },
      };
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
    };
  }
}
