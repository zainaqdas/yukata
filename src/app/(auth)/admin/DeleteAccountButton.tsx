"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccountButton({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`Delete "${accountName}"? This cannot be undone.`)) return;

    setDeleting(true);
    setError(null);
    try {
      await fetch(`/api/accounts?id=${accountId}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-950/30 transition-colors whitespace-nowrap disabled:opacity-50"
      >
        {deleting ? "..." : "Delete"}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
