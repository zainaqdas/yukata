"use client";

import { useState } from "react";

interface AccountData {
  id: string;
  name: string;
  patreonSessionId: string | null;
  sessionExpiresAt: Date | null;
  status: string;
  errorLog: string | null;
  lastSyncAt: Date | null;
  patreonCampaignId: string | null;
}

export function SessionManager({ account }: { account: AccountData }) {
  const [hasSession, setHasSession] = useState(!!account.patreonSessionId);
  const [sessionId, setSessionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sessionExpired = account.status === "session_expired";

  async function handleSave() {
    if (!sessionId.trim()) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, sessionId: sessionId.trim() }),
      });

      if (res.ok) {
        setHasSession(true);
        setSessionId("");
        setMessage("Session saved.");
      } else {
        const err = await res.json();
        setMessage(`Error: ${err.error}`);
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setMessage(null);

    try {
      await fetch(`/api/session?accountId=${account.id}`, { method: "DELETE" });
      setHasSession(false);
      setMessage("Session removed.");
    } catch {
      setMessage("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            hasSession && !sessionExpired ? "bg-green-400" : "bg-red-400"
          }`}
        />
        <span className="text-sm text-zinc-400">
          {hasSession && !sessionExpired ? "Session configured" : "No session"}
        </span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder={hasSession ? "Update session_id..." : "Paste session_id..."}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
        <button
          onClick={handleSave}
          disabled={saving || !sessionId.trim()}
          className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-medium text-white transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? "..." : "Save"}
        </button>
      </div>

      {hasSession && (
        <button
          onClick={handleRemove}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Remove session
        </button>
      )}

      {message && (
        <p className={`text-xs ${message.includes("Error") ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}

      {sessionExpired && (
        <div className="p-2 bg-red-950/20 border border-red-900/30 rounded-lg">
          <p className="text-xs text-red-400">
            Session expired. Update your session_id.
          </p>
        </div>
      )}
    </div>
  );
}
