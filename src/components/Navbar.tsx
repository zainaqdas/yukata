"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/posts", label: "Posts" },
  { href: "/gallery", label: "Gallery" },
  { href: "/search", label: "Search" },
];

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session?.user) return null;

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/posts" className="text-xl font-bold tracking-tight text-white hover:text-zinc-200 transition-colors">
              Patron<span className="text-violet-400">Hub</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    pathname.startsWith(link.href)
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname.startsWith("/admin")
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-zinc-400 hover:text-violet-300 hover:bg-violet-600/10"
                }`}
              >
                Admin
              </Link>
            )}
            <span className="text-sm text-zinc-500 hidden sm:block">
              {session.user.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-all"
            >
              Sign out
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="sm:hidden flex items-center gap-1 pb-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                pathname.startsWith(link.href)
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
