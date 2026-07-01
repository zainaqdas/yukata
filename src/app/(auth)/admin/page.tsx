import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSyncStatus } from "@/lib/patreon";
import { listInviteCodes } from "@/lib/invites";
import { format } from "date-fns";
import { InviteManager } from "@/components/InviteManager";
import { SyncButton } from "./SyncButton";
import { SessionManager } from "./SessionManager";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/posts");

  const [syncStatus, inviteCodes, postCount, userCount, videoCount] = await Promise.all([
    getSyncStatus(),
    listInviteCodes(),
    prisma.post.count(),
    prisma.user.count(),
    prisma.media.count({ where: { type: "HLS_VIDEO" } }),
  ]);

  const stats = [
    { label: "Total Posts", value: postCount },
    { label: "Members", value: userCount },
    { label: "Videos", value: videoCount },
    {
      label: "Last Sync",
      value: syncStatus?.lastSyncAt
        ? format(syncStatus.lastSyncAt, "MMM d, h:mm a")
        : "Never",
    },
  ];

  const hasSessionId = !!syncStatus?.patreonSessionId;
  const sessionExpired = syncStatus?.status === "session_expired";

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Admin Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
          >
            <p className="text-sm text-zinc-500">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Patreon Session ID */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">
          Patreon Session Cookie
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          Provide your Patreon <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-violet-400 text-xs font-mono">session_id</code> cookie.
          This authenticates the sync engine to fetch your own posts, including video HLS stream URLs.
        </p>
        <SessionManager initialHasSession={hasSessionId} sessionExpired={sessionExpired} />
        {sessionExpired && (
          <div className="mt-4 p-3 bg-red-950/20 border border-red-900/30 rounded-lg">
            <p className="text-sm text-red-400">
              Your session appears to have expired. Please extract a fresh session_id from your browser.
            </p>
          </div>
        )}
      </div>

      {/* Sync Status */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">Patreon Sync</h2>
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
              syncStatus?.status === "success"
                ? "bg-green-950/50 text-green-400 border border-green-900/30"
                : syncStatus?.status === "running"
                ? "bg-blue-950/50 text-blue-400 border border-blue-900/30"
                : syncStatus?.status === "session_expired"
                ? "bg-red-950/50 text-red-400 border border-red-900/30"
                : syncStatus?.status === "error"
                ? "bg-amber-950/50 text-amber-400 border border-amber-900/30"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
            }`}
          >
            {syncStatus?.status || "idle"}
          </span>
        </div>
        <div className="space-y-2 text-sm text-zinc-400">
          <p>
            Last synced:{" "}
            {syncStatus?.lastSyncAt
              ? format(syncStatus.lastSyncAt, "MMMM d, yyyy 'at' h:mm a")
              : "Never"}
          </p>
          {syncStatus?.errorLog && (
            <p className="text-red-400 bg-red-950/20 rounded-lg p-2 text-xs">
              Error: {syncStatus.errorLog}
            </p>
          )}
        </div>
        <SyncButton />
      </div>

      {/* Invite Management */}
      <InviteManager initialCodes={inviteCodes as any} />
    </div>
  );
}
