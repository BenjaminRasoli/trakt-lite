"use client";

import { useState, useEffect, useRef } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { useRouter } from "next/navigation";
import { getRandomBackdropUrl, getTrendingMedia } from "@/lib/tmdb";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importProgress, setImportProgress] = useState<string>("");
  const [exportProgress, setExportProgress] = useState<string>("");
  const [pageBackdrop, setPageBackdrop] = useState("");
  const [jellyfinConfig, setJellyfinConfig] = useState({
    serverUrl: "",
    apiKey: "",
    jellyfinUserId: "",
    enabled: true,
  });
  const [jellyfinStatus, setJellyfinStatus] = useState<string | null>(null);
  const [savingJellyfin, setSavingJellyfin] = useState(false);
  const [liveSession, setLiveSession] = useState<any>(null);
  const [loadingLiveSession, setLoadingLiveSession] = useState(false);
  const lastActiveSessionRef = useRef<any>(null);
  const lastActiveAtRef = useRef<number>(0);
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const updateUser = (nextUser: any) => {
      setUser((currentUser: any) => {
        if (!nextUser) return null;
        if (currentUser?.id === nextUser.id) return currentUser;
        return nextUser;
      });
    };

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      updateUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      updateUser(session?.user ?? null);
    });

    const fetchBackdrop = async () => {
      const trendingMedia = await getTrendingMedia();
      if (!isMounted) return;
      setPageBackdrop(getRandomBackdropUrl(trendingMedia));
    };

    void fetchBackdrop();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    const loadJellyfinSettings = async () => {
      try {
        const response = await fetch("/api/settings/jellyfin");
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!data || typeof data !== "object") {
          return;
        }

        setJellyfinConfig({
          serverUrl: data.serverUrl || "",
          apiKey: data.apiKey || "",
          jellyfinUserId: data.jellyfinUserId || "",
          enabled: data.enabled ?? true,
        });
      } catch {
        // Ignore config load errors; the form can remain blank.
      }
    };

    void loadJellyfinSettings();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchLiveSession = async () => {
      try {
        setLoadingLiveSession(true);
        const response = await fetch("/api/jellyfin/live");
        if (!response.ok) {
          if (
            lastActiveSessionRef.current &&
            Date.now() - lastActiveAtRef.current < 45000
          ) {
            setLiveSession(lastActiveSessionRef.current);
          } else {
            lastActiveSessionRef.current = null;
            setLiveSession(null);
          }
          return;
        }

        const data = await response.json();
        const nextSession = data?.active ?? null;

        if (nextSession) {
          lastActiveSessionRef.current = nextSession;
          lastActiveAtRef.current = Date.now();
          setLiveSession(nextSession);
        } else if (
          lastActiveSessionRef.current &&
          Date.now() - lastActiveAtRef.current < 45000
        ) {
          setLiveSession(lastActiveSessionRef.current);
        } else {
          lastActiveSessionRef.current = null;
          setLiveSession(null);
        }
      } catch {
        if (
          lastActiveSessionRef.current &&
          Date.now() - lastActiveAtRef.current < 45000
        ) {
          setLiveSession(lastActiveSessionRef.current);
        } else {
          lastActiveSessionRef.current = null;
          setLiveSession(null);
        }
      } finally {
        setLoadingLiveSession(false);
      }
    };

    void fetchLiveSession();
    const interval = setInterval(() => {
      void fetchLiveSession();
    }, 15000);

    return () => clearInterval(interval);
  }, [user]);

  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("zipFile") as File;

    if (!file) {
      setImportError("Please select a file");
      return;
    }

    if (!file.name.endsWith(".zip")) {
      setImportError("Please select a .zip file");
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportSuccess(false);
    setImportProgress("Uploading file...");

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      setImportProgress("Processing file...");
      const response = await fetch("/api/settings/import", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }

      setImportProgress("Importing data...");
      const result = await response.json();
      setImportProgress(`Successfully imported ${result.imported} entries`);
      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        setImportProgress("");
      }, 3000);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
      setImportProgress("");
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress("Preparing export...");

    try {
      setExportProgress("Fetching data...");
      const response = await fetch("/api/settings/export");
      if (!response.ok) {
        throw new Error("Export failed");
      }

      setExportProgress("Generating zip file...");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "trakt-export.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportProgress("Export complete!");
      setTimeout(() => {
        setExportProgress("");
      }, 2000);
    } catch (error) {
      console.error("Export error:", error);
      setExportProgress("");
    } finally {
      setExporting(false);
    }
  };

  const handleJellyfinSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingJellyfin(true);
    setJellyfinStatus(null);

    try {
      const response = await fetch("/api/settings/jellyfin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jellyfinConfig),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to save Jellyfin settings");
      }

      setJellyfinStatus("Jellyfin scrobble sync saved successfully.");
    } catch (error) {
      setJellyfinStatus(
        error instanceof Error
          ? error.message
          : "Unable to save Jellyfin settings.",
      );
    } finally {
      setSavingJellyfin(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-black font-sans">
        <div className="flex items-center gap-3 text-violet-300">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
          <span className="text-sm font-medium uppercase tracking-[0.2em]">
            Loading
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/auth");
    return null;
  }

  return (
    <div className="relative flex flex-col flex-1 font-sans min-h-screen bg-black overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80">
        {pageBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-35"
            style={{ backgroundImage: `url(${pageBackdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/55 to-black/80" />
      </div>

      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

        <div className="space-y-8">
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700/50">
            <h2 className="text-xl font-bold text-white mb-4">
              Import Watch Data
            </h2>
            <p className="text-zinc-400 mb-4">
              Import your watch history from a Trakt export file. This will
              replace all existing data.
            </p>
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-zinc-300 mb-2">
                  Select Trakt Export File (.zip)
                </label>
                <input
                  type="file"
                  name="zipFile"
                  accept=".zip"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              {importError && (
                <div className="text-red-400 text-sm">{importError}</div>
              )}
              {importSuccess && (
                <div className="text-green-400 text-sm">Import successful!</div>
              )}
              <button
                type="submit"
                disabled={importing}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Importing...
                  </>
                ) : (
                  "Import Data"
                )}
              </button>
            </form>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700/50">
            <h2 className="text-xl font-bold text-white mb-4">
              Export Watch Data
            </h2>
            <p className="text-zinc-400 mb-4">
              Export all your watch history in Trakt format as a .zip file.
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Exporting...
                </>
              ) : (
                "Export Data"
              )}
            </button>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700/50">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">
                Jellyfin scrobble sync
              </h2>
              {liveSession && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Live
                </span>
              )}
            </div>

            {loadingLiveSession ? (
              <p className="mb-4 text-sm text-zinc-400">
                Checking Jellyfin session...
              </p>
            ) : liveSession ? (
              <div className="mb-5 overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                <div className="flex gap-4 p-4">
                  <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-emerald-500/30 bg-zinc-900">
                    {liveSession.posterUrl ? (
                      <img
                        src={liveSession.posterUrl}
                        alt={liveSession.title}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src = "/placeholder-poster.svg";
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                        Live
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
                        Now playing
                      </p>
                    </div>
                    <p className="truncate text-lg font-bold text-white">
                      {liveSession.title}
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {liveSession.episodeLabel
                        ? `${liveSession.type} • ${liveSession.episodeLabel}`
                        : liveSession.type}
                      {" • "}
                      {Math.round(liveSession.percent)}% watched
                    </p>
                    <p className="mt-1 text-xs text-emerald-200">
                      {liveSession.remainingMinutes > 0
                        ? `${liveSession.remainingMinutes} min left`
                        : "Finishing up"}
                    </p>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400"
                        style={{
                          width: `${Math.min(100, Math.max(0, liveSession.percent))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mb-5 text-sm text-zinc-400">
                No active Jellyfin session right now.
              </p>
            )}

            <p className="text-zinc-400 mb-4">
              Connect your Jellyfin server so playback completion from Jellyfin
              can be synced into this app as watched history.
            </p>

            <form onSubmit={handleJellyfinSave} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Jellyfin server URL
                </label>
                <input
                  type="url"
                  value={jellyfinConfig.serverUrl}
                  onChange={(event) =>
                    setJellyfinConfig((current) => ({
                      ...current,
                      serverUrl: event.target.value,
                    }))
                  }
                  placeholder="https://jellyfin.example.com"
                  className="w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Jellyfin API key
                </label>
                <input
                  type="password"
                  value={jellyfinConfig.apiKey}
                  onChange={(event) =>
                    setJellyfinConfig((current) => ({
                      ...current,
                      apiKey: event.target.value,
                    }))
                  }
                  placeholder="Enter your Jellyfin API key"
                  className="w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Jellyfin user ID
                </label>
                <input
                  type="text"
                  value={jellyfinConfig.jellyfinUserId}
                  onChange={(event) =>
                    setJellyfinConfig((current) => ({
                      ...current,
                      jellyfinUserId: event.target.value,
                    }))
                  }
                  placeholder="Copy the user ID from Jellyfin"
                  className="w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-white outline-none focus:border-violet-500"
                />
              </div>

              <label className="flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={jellyfinConfig.enabled}
                  onChange={(event) =>
                    setJellyfinConfig((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-violet-500"
                />
                Enable Jellyfin scrobble sync
              </label>

              {jellyfinStatus && (
                <p className="text-sm text-violet-200">{jellyfinStatus}</p>
              )}

              <button
                type="submit"
                disabled={savingJellyfin}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingJellyfin ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving...
                  </>
                ) : (
                  "Save Jellyfin settings"
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
