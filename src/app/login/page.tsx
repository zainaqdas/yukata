import { LoginForm } from "@/components/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-zinc-900 to-zinc-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Patron<span className="text-violet-400">Hub</span>
          </h1>
          <p className="text-zinc-400">
            Your private content platform. Sign in with your invite code.
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <LoginForm />
        </div>
        <p className="text-center text-sm text-zinc-600 mt-6">
          Don't have an invite?{" "}
          <Link href="#" className="text-violet-400 hover:text-violet-300 transition-colors">
            Contact us
          </Link>{" "}
          for access.
        </p>
      </div>
    </div>
  );
}
