"use client";

import { useState } from "react";

export function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setResult(`Synced ${data.syncedCount} new posts (${data.total} checked).`);
      } else {
        setError(data.error || "Sync failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-all disabled:opacity-50"
      >
        {loading ? "Syncing..." : "Trigger Manual Sync"}
      </button>
      {result && (
        <p className="mt-2 text-sm text-green-400">{result}</p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
