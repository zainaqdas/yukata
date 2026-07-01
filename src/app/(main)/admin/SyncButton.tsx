"use client";

import { useState } from "react";

interface SyncResultEntry {
  accountName: string;
  syncedCount: number;
  total: number;
  error?: string;
}

interface SyncApiResponse {
  results?: SyncResultEntry[];
  syncedCount?: number;
  total?: number;
  error?: string;
}

export function SyncButton({ accountId }: { accountId?: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountId ? { accountId } : {}),
      });
      const data: SyncApiResponse = await res.json();

      if (res.ok) {
        if (data.results) {
          const totalSynced = data.results.reduce((sum: number, r: SyncResultEntry) => sum + (r.syncedCount || 0), 0);
          const failures = data.results.filter((r: SyncResultEntry) => r.error);
          let msg = `Synced ${totalSynced} posts across ${data.results.length} accounts.`;
          if (failures.length > 0) {
            msg += ` ${failures.length} account(s) failed: ${failures.map((f: SyncResultEntry) => f.accountName).join(", ")}`;
            setError(msg);
          } else {
            setResult(msg);
          }
        } else {
          setResult(`Synced ${data.syncedCount} new posts (${data.total} checked).`);
        }
      } else {
        setError(data.error || "Sync failed");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-medium text-white transition-all disabled:opacity-50"
      >
        {loading ? "Syncing..." : accountId ? "Sync This Account" : "Sync All Accounts"}
      </button>
      {result && <p className="mt-1.5 text-xs text-green-400">{result}</p>}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
