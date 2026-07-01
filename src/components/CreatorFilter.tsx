"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface CreatorFilterProps {
  accounts: Array<{ id: string; name: string }>;
  selected?: string;
}

export function CreatorFilter({ accounts, selected }: CreatorFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("creator", value);
    } else {
      params.delete("creator");
    }
    params.delete("page"); // reset to page 1 on filter change
    const qs = params.toString();
    router.push("/posts" + (qs ? `?${qs}` : ""));
  }

  return (
    <>
      <select
        value={selected || ""}
        onChange={(e) => handleChange(e.target.value)}
        className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m2%204%204%204%204-4%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-8 min-w-[180px]"
      >
        <option value="">All creators</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      {selected && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-950/50 text-violet-300 border border-violet-900/30">
          {accounts.find((a) => a.id === selected)?.name || selected}
          <button
            onClick={() => handleChange("")}
            className="hover:text-violet-100 ml-0.5"
          >
            &times;
          </button>
        </span>
      )}
    </>
  );
}
