"use client";

import { useState } from "react";

interface InviteCodeWithUsers {
  id: string;
  code: string;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
  users: Array<{ email: string; createdAt: string }>;
}

export function InviteManager({ initialCodes }: { initialCodes: InviteCodeWithUsers[] }) {
  const [codes, setCodes] = useState(initialCodes);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState(100);
  const [expiresInDays, setExpiresInDays] = useState("");

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxUses,
          note: note || undefined,
          expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
        }),
      });
      const newCode = await res.json();
      setCodes([newCode, ...codes]);
      setNote("");
      setMaxUses(100);
      setExpiresInDays("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(code: string) {
    try {
      await fetch(`/api/invites?code=${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
      setCodes(codes.map((c) => (c.code === code ? { ...c, isActive: false } : c)));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      {/* Create invite */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">Create Invite Code</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Max uses</label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
              min={1}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Expires in (days, optional)</label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="No expiry"
              min={1}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. VIP tier"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-all disabled:opacity-50"
        >
          {loading ? "Creating..." : "Generate invite code"}
        </button>
      </div>

      {/* Invite list */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-100">Active Invite Codes</h3>
        {codes.length === 0 && (
          <p className="text-zinc-500">No invite codes yet. Create one above.</p>
        )}
        {codes.map((code) => (
          <div
            key={code.id}
            className={`bg-zinc-900 border rounded-xl p-4 flex items-center justify-between gap-4 ${
              code.isActive ? "border-zinc-800" : "border-zinc-800/50 opacity-50"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-violet-400">{code.code}</span>
                {!code.isActive && (
                  <span className="px-2 py-0.5 rounded text-xs bg-red-950/50 text-red-400 border border-red-900/30">
                    Deactivated
                  </span>
                )}
                {code.note && (
                  <span className="text-xs text-zinc-500">{code.note}</span>
                )}
              </div>
              <div className="flex gap-4 mt-1.5 text-xs text-zinc-500">
                <span>
                  {code.currentUses} / {code.maxUses} used
                </span>
                {code.expiresAt && (
                  <span>Expires {new Date(code.expiresAt).toLocaleDateString()}</span>
                )}
              </div>
              {code.users.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {code.users.map((u) => (
                    <span
                      key={u.email}
                      className="px-2 py-0.5 rounded-md text-xs bg-zinc-800 text-zinc-400"
                    >
                      {u.email}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {code.isActive && (
              <button
                onClick={() => handleDeactivate(code.code)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-950/30 transition-colors"
              >
                Deactivate
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
