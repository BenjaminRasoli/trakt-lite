"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = useSupabase();
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMessage("Your password has been updated. Redirecting...");
      setTimeout(() => router.push("/"), 1000);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-8">
      <section className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-8 shadow-2xl">
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold text-white">
            Choose a new password
          </h1>
          <p className="text-sm text-zinc-400">
            Enter and confirm your new password.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-700/50 bg-red-900/30 p-4 text-red-200"
          >
            {error}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="rounded-lg border border-green-700/50 bg-green-900/30 p-4 text-green-200"
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-zinc-600/50 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-zinc-600/50 bg-zinc-800/50 px-4 py-3 text-white placeholder-zinc-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-base font-semibold text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>
    </main>
  );
}
