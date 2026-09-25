"use client";

import { useState } from "react";
import { useSupabase } from "./supabase-provider";
import { useRouter } from "next/navigation";

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = useSupabase();
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage("Account created successfully!");
        setTimeout(() => {
          router.push("/");
        }, 1000);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Successfully logged in!");
        setTimeout(() => {
          router.push("/");
        }, 1000);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl shadow-2xl border border-zinc-700/50 backdrop-blur-sm w-full max-w-lg">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h2>
        <p className="text-zinc-400 text-sm">
          {isSignUp
            ? "Choose a username, email, and password"
            : "Sign in to continue tracking"}
        </p>
      </div>

      {error && (
        <div className="w-full p-4 bg-red-900/30 border border-red-700/50 text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {message && (
        <div className="w-full p-4 bg-green-900/30 border border-green-700/50 text-green-200 rounded-lg">
          {message}
        </div>
      )}

      <form onSubmit={handleAuth} className="flex flex-col gap-4 w-full">
        {isSignUp && (
          <div className="relative">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-600/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
            />
          </div>
        )}
        <div className="relative">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-600/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
          />
        </div>
        <div className="relative">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-600/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-base font-semibold text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
        </button>
      </form>

      <div className="flex items-center gap-2 w-full">
        <div className="flex-1 h-px bg-zinc-700"></div>
        <span className="text-zinc-500 text-sm">or</span>
        <div className="flex-1 h-px bg-zinc-700"></div>
      </div>

      <button
        onClick={() => setIsSignUp(!isSignUp)}
        className="text-violet-400 hover:text-violet-300 hover:underline font-medium transition-colors cursor-pointer"
      >
        {isSignUp
          ? "Already have an account? Sign in"
          : "Don't have an account? Sign up"}
      </button>
    </div>
  );
}
