"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";export function DiscoverButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDiscover() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/accounts/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult(`Discovered ${data.discovered} new creator(s). ${data.campaigns.length} total.`);
        router.refresh();
      } else {
        setError(data.error || "Discovery failed");
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
        onClick={handleDiscover}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? "Discovering..." : "Discover Followed"}
      </button>
      {result && <p className="mt-1 text-xs text-green-400">{result}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}


