"use client";

import { useState } from "react";

export function SessionManager({
  initialHasSession,
  sessionExpired,
}: {
  initialHasSession: boolean;
  sessionExpired: boolean;
}) {
  const [hasSession, setHasSession] = useState(initialHasSession);
  const [sessionId, setSessionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    if (!sessionId.trim()) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.trim() }),
      });

      if (res.ok) {
        setHasSession(true);
        setSessionId("");
        setMessage("Session ID saved successfully.");
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
      await fetch("/api/session", { method: "DELETE" });
      setHasSession(false);
      setSessionId("");
      setMessage("Session ID removed.");
    } catch {
      setMessage("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-2 h-2 rounded-full ${
            hasSession && !sessionExpired ? "bg-green-400" : "bg-red-400"
          }`}
        />
        <span className="text-sm text-zinc-400">
          {hasSession && !sessionExpired
            ? "Session configured"
            : "No session configured"}
        </span>
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          type="text"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder={
            hasSession ? "Paste new session_id to update..." : "Paste your Patreon session_id cookie..."
          }
          className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
        />
        <button
          onClick={handleSave}
          disabled={saving || !sessionId.trim()}
          className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-all disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Remove button */}
      {hasSession && (
        <button
          onClick={handleRemove}
          className="mt-2 text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Remove saved session
        </button>
      )}

      {/* Feedback */}
      {message && (
        <p
          className={`mt-2 text-sm ${
            message.includes("Error") ? "text-red-400" : "text-green-400"
          }`}
        >
          {message}
        </p>
      )}

      {/* Help text */}
      <details className="mt-4 text-xs text-zinc-500">
        <summary className="cursor-pointer hover:text-zinc-400 transition-colors">
          How to find your session_id
        </summary>
        <ol className="mt-2 space-y-1 list-decimal list-inside text-zinc-500">
          <li>Open Patreon in your browser and log in</li>
          <li>
            Open Developer Tools (<kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">F12</kbd>)
          </li>
          <li>Go to Application → Cookies → patreon.com</li>
          <li>Find <code className="px-1 py-0.5 rounded bg-zinc-800 text-violet-400">session_id</code> and copy its value</li>
          <li>Paste it above and click Save</li>
        </ol>
      </details>
    </div>
  );
}
