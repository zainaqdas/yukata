"use client";

interface SearchBarProps {
  query: string;
  type: string;
  onQueryChange: (query: string) => void;
  onTypeChange: (type: string) => void;
}

export function SearchBar({ query, type, onQueryChange, onTypeChange }: SearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
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
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search posts... (results update as you type)"
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
          autoFocus
        />
      </div>
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        className="px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
      >
        <option value="all">All types</option>
        <option value="VIDEO">Video</option>
        <option value="IMAGE">Image</option>
        <option value="AUDIO">Audio</option>
        <option value="TEXT">Text</option>
        <option value="FILE">File</option>
      </select>
    </div>
  );
}
