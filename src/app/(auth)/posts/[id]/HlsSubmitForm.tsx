"use client";

import { useState } from "react";

export default function HlsSubmitForm({ postId }: { postId: string }) {
  const [hlsUrl, setHlsUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hlsUrl) return;
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/hls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, hlsManifestUrl: hlsUrl, durationMinutes: 120 }),
      });
      if (res.ok) {
        setResult("HLS URL submitted successfully. Refresh the page to watch.");
      } else {
        const err = await res.json();
        setResult(`Error: ${err.error}`);
      }
    } catch {
      setResult("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="url"
        value={hlsUrl}
        onChange={(e) => setHlsUrl(e.target.value)}
        placeholder="Paste HLS manifest URL (.m3u8)..."
        className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
      />
      <button
        type="submit"
        disabled={submitting || !hlsUrl}
        className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-all disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Submit"}
      </button>
      {result && <p className="text-sm text-zinc-400 mt-2 col-span-2">{result}</p>}
    </form>
  );
}
