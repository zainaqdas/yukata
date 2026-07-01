"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddAccountForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), campaignId: campaignId.trim() || undefined }),
      });

      if (res.ok) {
        setName("");
        setCampaignId("");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create account");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Account name (e.g. Gaming Channel)"
        className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
      />
      <input
        type="text"
        value={campaignId}
        onChange={(e) => setCampaignId(e.target.value)}
        placeholder="Patreon Campaign ID (optional)"
        className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50"
      />
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-all disabled:opacity-50 whitespace-nowrap"
      >
        {saving ? "Adding..." : "Add Account"}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </form>
  );
}
