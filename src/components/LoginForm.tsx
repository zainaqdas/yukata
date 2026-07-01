"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !inviteCode) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Validate and claim invite code
      const res = await fetch(`/api/invites/validate?code=${encodeURIComponent(inviteCode)}&email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!data.valid) {
        setError("Invalid or expired invite code.");
        setLoading(false);
        return;
      }

      // Send magic link
      await signIn("nodemailer", {
        email,
        redirect: false,
        callbackUrl: "/posts",
      });

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center p-8">
        <div className="w-16 h-16 rounded-full bg-violet-600/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">Check your email</h2>
        <p className="text-zinc-400">
          We sent a magic link to <span className="text-zinc-200 font-medium">{email}</span>.
          Click the link in the email to sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1.5">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
        />
      </div>
      <div>
        <label htmlFor="invite" className="block text-sm font-medium text-zinc-400 mb-1.5">
          Invite code
        </label>
        <input
          id="invite"
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="Enter your invite code"
          required
          className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all font-mono tracking-wider"
        />
      </div>
      {error && (
        <p className="text-red-400 text-sm bg-red-950/30 rounded-lg px-4 py-2.5 border border-red-900/50">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-violet-600/25"
      >
        {loading ? "Sending..." : "Sign in with magic link"}
      </button>
    </form>
  );
}
