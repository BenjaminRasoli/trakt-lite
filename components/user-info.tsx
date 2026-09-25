"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "./supabase-provider";
import type { User } from "@supabase/supabase-js";

export default function UserInfo() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabase();

  useEffect(() => {
    const updateUser = (nextUser: User | null) => {
      setUser((currentUser) => {
        if (!nextUser) return null;
        if (currentUser?.id === nextUser.id) return currentUser;
        return nextUser;
      });
    };

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      updateUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  if (loading) {
    return <div className="text-zinc-400">Loading...</div>;
  }

  if (!user) {
    return <div className="text-zinc-400">Not authenticated</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold">
          {user.email?.[0].toUpperCase()}
        </div>
        <div className="text-white">
          <span className="font-semibold text-amber-400">Email:</span>{" "}
          {user.email}
        </div>
      </div>
      <div className="text-zinc-300 text-sm">
        <span className="font-semibold text-amber-400">ID:</span>{" "}
        {user.id.slice(0, 8)}...
      </div>
      <div className="text-zinc-300 text-sm">
        <span className="font-semibold text-amber-400">Created at:</span>{" "}
        {new Date(user.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}
