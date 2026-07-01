"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce query input so search doesn't fire on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const handleTypeChange = useCallback((t: string) => {
    setType(t);
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-4">Search</h1>
        <SearchBar
          query={query}
          type={type}
          onQueryChange={handleQueryChange}
          onTypeChange={handleTypeChange}
        />
      </div>

      {debouncedQuery ? (
        <SearchResults
          key={`${debouncedQuery}|${type}`}
          query={debouncedQuery}
          type={type}
        />
      ) : (
        <div className="text-center py-20">
          <p className="text-zinc-500 text-lg">Enter a search term to find posts.</p>
          <p className="text-zinc-600 text-sm mt-1">
            Results appear as you type &mdash; no need to press Enter.
          </p>
        </div>
      )}
    </div>
  );
}
