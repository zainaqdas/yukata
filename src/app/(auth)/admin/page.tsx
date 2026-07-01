import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listCreatorAccounts } from "@/lib/patreon";
import { listInviteCodes } from "@/lib/invites";
import { format } from "date-fns";
import { InviteManager } from "@/components/InviteManager";
import { SyncButton } from "./SyncButton";
import { SessionManager } from "./SessionManager";
import { AddAccountForm } from "./AddAccountForm";
import { DeleteAccountButton } from "./DeleteAccountButton";
import { DiscoverButton } from "./DiscoverButton";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/posts");

  const [accounts, inviteCodes, postCount, userCount, videoCount] = await Promise.all([
    listCreatorAccounts(),
    listInviteCodes(),
    prisma.post.count(),
    prisma.user.count(),
    prisma.media.count({ where: { type: "HLS_VIDEO" } }),
  ]);

  const lastSyncAt = accounts.reduce((latest: Date | null, a) => {
    if (!a.lastSyncAt) return latest;
    return !latest || a.lastSyncAt > latest ? a.lastSyncAt : latest;
  }, null);

  const ownedCount = accounts.filter((a) => a.isOwned).length;
  const followedCount = accounts.filter((a) => !a.isOwned).length;

  const stats = [
    { label: "Total Posts", value: postCount },
    { label: "Members", value: userCount },
    { label: "Videos", value: videoCount },
    { label: "Owned", value: ownedCount },
    { label: "Followed", value: followedCount },
    {
      label: "Last Sync",
      value: lastSyncAt ? format(lastSyncAt, "MMM d, h:mm a") : "Never",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <SyncButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-500">{stat.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Creator Accounts */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-zinc-100">Creator Accounts</h2>
        </div>

        <div className="space-y-6">
          {accounts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-zinc-500">No creator accounts yet. Add your own or discover followed creators.</p>
            </div>
          )}

          {accounts.map((account) => {
            const parent = !account.isOwned && account.parentAccountId
              ? accounts.find((a) => a.id === account.parentAccountId)
              : null;

            return (
              <div
                key={account.id}
                className={`rounded-xl p-4 border ${
                  account.isOwned
                    ? "bg-zinc-800/50 border-zinc-700/50"
                    : "bg-emerald-950/10 border-emerald-900/20"
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-100">{account.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          account.isOwned
                            ? "bg-violet-950/50 text-violet-300 border border-violet-900/30"
                            : "bg-emerald-950/50 text-emerald-300 border border-emerald-900/30"
                        }`}
                      >
                        {account.isOwned ? "Owned" : "Followed"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                          account.status === "success"
                            ? "bg-green-950/50 text-green-400 border border-green-900/30"
                            : account.status === "running"
                            ? "bg-blue-950/50 text-blue-400 border border-blue-900/30"
                            : account.status === "session_expired"
                            ? "bg-red-950/50 text-red-400 border border-red-900/30"
                            : account.status === "error"
                            ? "bg-amber-950/50 text-amber-400 border border-amber-900/30"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {account.status || "idle"}
                      </span>
                      {account.lastSyncAt && (
                        <span className="text-xs text-zinc-500">
                          Last sync: {format(account.lastSyncAt, "MMM d, h:mm a")}
                        </span>
                      )}
                      {account.patreonCampaignId && (
                        <span className="text-xs font-mono text-zinc-600">
                          Campaign: {account.patreonCampaignId.slice(0, 8)}...
                        </span>
                      )}
                      {parent && (
                        <span className="text-xs text-zinc-500">
                          via {parent.name}
                        </span>
                      )}
                    </div>
                    {account.errorLog && (
                      <p className="mt-1.5 text-xs text-red-400 bg-red-950/20 rounded-lg p-1.5">
                        {account.errorLog}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <SyncButton accountId={account.id} />
                    {account.isOwned && <DiscoverButton accountId={account.id} accountName={account.name} />}
                    <DeleteAccountButton accountId={account.id} accountName={account.name} />
                  </div>
                </div>

                {/* Session manager — only for owned accounts */}
                {account.isOwned && (
                  <div className="border-t border-zinc-700/30 pt-3">
                    <p className="text-xs text-zinc-500 mb-2">
                      Patreon <code className="px-1 py-0.5 rounded bg-zinc-800 text-violet-400 text-xs">session_id</code>
                    </p>
                    <SessionManager account={account as any} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add new owned account */}
        <div className="mt-6 pt-6 border-t border-zinc-700/50">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Add Owned Account</h3>
          <AddAccountForm />
        </div>
      </div>

      {/* Invite Management */}
      <InviteManager initialCodes={inviteCodes as any} />
    </div>
  );
}
