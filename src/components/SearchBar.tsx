"use client";

import { useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export function SearchBar() {
  // Derive initial values from search params — no useEffect syncing needed
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [type, setType] = useState(() => searchParams.get("type") || "all");

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (type && type !== "all") params.set("type", type);
      router.push(`/search?${params.toString()}`);
    },
    [query, type, router]
  );

  return (
    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts..."
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
        />
      </div>
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
      >
        <option value="all">All types</option>
        <option value="VIDEO">Video</option>
        <option value="IMAGE">Image</option>
        <option value="AUDIO">Audio</option>
        <option value="TEXT">Text</option>
        <option value="FILE">File</option>
      </select>
      <button
        type="submit"
        className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-all hover:shadow-lg hover:shadow-violet-600/25"
      >
        Search
      </button>
    </form>
  );
}
