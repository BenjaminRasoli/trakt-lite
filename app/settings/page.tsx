"use client";

import { useState, useEffect, useRef } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getRandomBackdropUrl, getTrendingMedia } from "@/lib/tmdb";

type AccountAction = "reset" | "delete";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importProgress, setImportProgress] = useState<string>("");
  const [importPercent, setImportPercent] = useState<number>(0);
  const [exportProgress, setExportProgress] = useState<string>("");
  const [pageBackdrop, setPageBackdrop] = useState("");
  const [jellyfinConfig, setJellyfinConfig] = useState({
    serverUrl: "",
    username: "",
    apiKey: "",
    enabled: true,
  });
  const [jellyfinStatus, setJellyfinStatus] = useState<string | null>(null);
  const [savingJellyfin, setSavingJellyfin] = useState(false);
  const [hasSavedJellyfinApiKey, setHasSavedJellyfinApiKey] = useState(false);
  const [jellyfinConnected, setJellyfinConnected] = useState(false);
  const [jellyfinImport, setJellyfinImport] = useState({
    serverUrl: "",
    username: "",
    apiKey: "",
  });
  const [importingJellyfin, setImportingJellyfin] = useState(false);
  const [jellyfinImportError, setJellyfinImportError] = useState<string | null>(
    null,
  );
  const [jellyfinImportSuccess, setJellyfinImportSuccess] = useState(false);
  const [jellyfinImportProgress, setJellyfinImportProgress] =
    useState<string>("");
  const [jellyfinImportPercent, setJellyfinImportPercent] = useState<number>(0);
  const [liveSession, setLiveSession] = useState<any>(null);
  const [loadingLiveSession, setLoadingLiveSession] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null);
  const [accountConfirmation, setAccountConfirmation] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const lastActiveSessionRef = useRef<any>(null);
  const lastActiveAtRef = useRef<number>(0);
  const initialLiveCheckRef = useRef(false);
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = showSignOutConfirm ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [showSignOutConfirm]);

  useEffect(() => {
    if (!showSignOutConfirm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !signingOut) {
        setShowSignOutConfirm(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      const modal = document.getElementById("sign-out-modal");
      if (modal && !modal.contains(event.target as Node) && !signingOut) {
        setShowSignOutConfirm(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSignOutConfirm, signingOut]);

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

        setHasSavedJellyfinApiKey(data.hasApiKey === true);
        setJellyfinConnected(data.enabled === true && data.hasApiKey === true);
        setJellyfinConfig({
          serverUrl: data.serverUrl || "",
          username: data.username || "",
          apiKey: "",
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
      const isInitialLoad = !initialLiveCheckRef.current;
      if (isInitialLoad) {
        initialLiveCheckRef.current = true;
        setLoadingLiveSession(true);
      }

      try {
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
        if (isInitialLoad) {
          setLoadingLiveSession(false);
        }
      }
    };

    void fetchLiveSession();
    const interval = setInterval(() => {
      void fetchLiveSession();
    }, 15000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
    setImportPercent(0);
    setExportProgress("");
    setJellyfinStatus(null);
    setJellyfinImportError(null);
    setJellyfinImportSuccess(false);
    setJellyfinImportProgress("");
    setJellyfinImportPercent(0);

    (e.currentTarget.elements.namedItem("zipFile") as HTMLInputElement).value =
      "";

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const response = await fetch("/api/settings/import", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Failed to read response");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.status) {
                setImportProgress(data.status);
              }

              if (data.progress !== undefined) {
                setImportPercent(data.progress);
              }

              if (data.success) {
                const watchlistMsg =
                  data.watchlistImported > 0
                    ? ` and ${data.watchlistImported} watchlist items`
                    : "";
                const ratingsMsg =
                  data.ratingsImported > 0
                    ? ` and ${data.ratingsImported} ratings`
                    : "";
                setImportProgress(
                  `Successfully imported ${data.imported} entries${ratingsMsg}${watchlistMsg}`,
                );
                setImportSuccess(true);
                setImportPercent(100);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
      setImportProgress("");
      setImportPercent(0);
      setImportSuccess(false);
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress("Preparing export...");
    setImportError(null);
    setImportSuccess(false);
    setImportProgress("");
    setImportPercent(0);
    setJellyfinStatus(null);
    setJellyfinImportError(null);
    setJellyfinImportSuccess(false);
    setJellyfinImportProgress("");
    setJellyfinImportPercent(0);

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
    setImportError(null);
    setImportSuccess(false);
    setImportProgress("");
    setImportPercent(0);
    setExportProgress("");
    setJellyfinImportError(null);
    setJellyfinImportSuccess(false);
    setJellyfinImportProgress("");
    setJellyfinImportPercent(0);

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

      setHasSavedJellyfinApiKey(data.config?.hasApiKey === true);
      setJellyfinConnected(
        data.config?.enabled === true && data.config?.hasApiKey === true,
      );
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

  const handleJellyfinImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setImportingJellyfin(true);
    setJellyfinImportError(null);
    setJellyfinImportSuccess(false);
    setJellyfinImportProgress("Connecting to Jellyfin...");
    setJellyfinImportPercent(0);
    setImportError(null);
    setImportSuccess(false);
    setImportProgress("");
    setImportPercent(0);
    setExportProgress("");
    setJellyfinStatus(null);

    try {
      const response = await fetch("/api/settings/jellyfin-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jellyfinImport),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Failed to read response");
      }

      let buffer = "";
      let importCompleted = false;
      const processEvent = (event: string) => {
        const dataLine = event
          .split(/\r?\n/)
          .find((line) => line.startsWith("data: "));
        if (!dataLine) return;

        const data = JSON.parse(dataLine.slice(6));
        if (data.error) {
          throw new Error(data.error);
        }

        if (data.status) {
          setJellyfinImportProgress(data.status);
        }

        if (data.progress !== undefined) {
          setJellyfinImportPercent(data.progress);
        }

        if (data.success) {
          setJellyfinImportProgress(
            `Successfully imported ${data.imported} entries`,
          );
          setJellyfinImportSuccess(true);
          setJellyfinImportPercent(100);
          importCompleted = true;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        let boundary = /\r?\n\r?\n/.exec(buffer);
        while (boundary) {
          processEvent(buffer.slice(0, boundary.index));
          buffer = buffer.slice(boundary.index + boundary[0].length);
          boundary = /\r?\n\r?\n/.exec(buffer);
        }

        if (done) break;
      }

      if (buffer.trim()) processEvent(buffer);
      if (!importCompleted) {
        throw new Error("Import ended before it completed");
      }
    } catch (error) {
      setJellyfinImportError(
        error instanceof Error ? error.message : "Import failed",
      );
      setJellyfinImportProgress("");
      setJellyfinImportPercent(0);
      setJellyfinImportSuccess(false);
    } finally {
      setImportingJellyfin(false);
    }
  };

  const handleAccountAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!accountAction) return;

    const confirmation = accountAction === "reset" ? "RESET" : "DELETE";
    if (accountConfirmation.trim() !== confirmation) return;

    setAccountBusy(true);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      const response = await fetch("/api/settings/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: accountAction, confirmation }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to complete account action.");
      }

      if (accountAction === "reset") {
        setAccountAction(null);
        setAccountConfirmation("");
        setAccountSuccess("Your account data has been erased. You can start fresh.");
        router.refresh();
        return;
      }

      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error("Account deleted, but sign-out failed:", error);
          setAccountError(
            "Your account was deleted, but this browser session could not be signed out. Please close this tab.",
          );
        }
      } catch (error) {
        console.error("Account deleted, but sign-out failed:", error);
        setAccountError(
          "Your account was deleted, but this browser session could not be signed out. Please close this tab.",
        );
      } finally {
        router.replace("/auth");
        router.refresh();
      }
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? error.message
          : "Unable to complete account action.",
      );
    } finally {
      setAccountBusy(false);
    }
  };

  const confirmSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      router.replace("/auth");
      router.refresh();
    } catch (error) {
      console.error("Error signing out:", error);
      setSignOutError(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    } finally {
      setSigningOut(false);
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
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <button
            type="button"
            onClick={() => {
              setSignOutError(null);
              setShowSignOutConfirm(true);
            }}
            className="inline-flex cursor-pointer items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            Sign out
          </button>
        </div>

        <div className="space-y-8">
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700/50">
            <h2 className="text-xl font-bold text-white mb-4">
              Import Watch Data
            </h2>
            <p className="text-zinc-400 mb-4">
              Import your watch history and ratings from a Trakt export file.
              Existing watch history is replaced; imported ratings are added or
              updated.
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
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-base text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              {importError && (
                <div className="text-red-400 text-sm">{importError}</div>
              )}
              {importSuccess && (
                <div className="text-green-400 text-sm">Import successful!</div>
              )}
              {importProgress && !importSuccess && (
                <div className="space-y-2">
                  <div className="text-violet-300 text-sm">
                    {importProgress}
                  </div>
                  {importPercent > 0 && importPercent < 100 && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-300"
                        style={{ width: `${importPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={importing}
                className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 transition ${!importing ? "hover:border-violet-400 hover:bg-violet-500/20" : ""} disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-violet-500/40 disabled:hover:bg-violet-500/10`}
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
              Export your watch history and ratings in Trakt format as a .zip
              file.
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-violet-500/40 disabled:hover:bg-violet-500/10"
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
            <h2 className="text-xl font-bold text-white mb-4">
              Import Watch Data from Jellyfin
            </h2>
            <p className="text-zinc-400 mb-4">
              Import your watch history directly from Jellyfin. This will
              overwrite all existing data.
            </p>
            <form onSubmit={handleJellyfinImport} className="space-y-4">
              <div>
                <label className="block text-zinc-300 mb-2">
                  Jellyfin Server URL
                </label>
                <input
                  type="url"
                  value={jellyfinImport.serverUrl}
                  onChange={(e) =>
                    setJellyfinImport((current) => ({
                      ...current,
                      serverUrl: e.target.value,
                    }))
                  }
                  placeholder="https://jellyfin.example.com"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-base text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-300 mb-2">Username</label>
                <input
                  type="text"
                  value={jellyfinImport.username}
                  onChange={(e) =>
                    setJellyfinImport((current) => ({
                      ...current,
                      username: e.target.value,
                    }))
                  }
                  placeholder="Your Jellyfin username"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-base text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-300 mb-2">API key</label>
                <input
                  type="password"
                  autoComplete="off"
                  value={jellyfinImport.apiKey}
                  onChange={(e) =>
                    setJellyfinImport((current) => ({
                      ...current,
                      apiKey: e.target.value,
                    }))
                  }
                  placeholder="Jellyfin API key"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-base text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Create an API key in Jellyfin Dashboard &gt; API Keys.
                </p>
              </div>
              {jellyfinImportError && (
                <div className="text-red-400 text-sm">
                  {jellyfinImportError}
                </div>
              )}
              {jellyfinImportSuccess && (
                <div className="text-green-400 text-sm">Import successful!</div>
              )}
              {jellyfinImportProgress && !jellyfinImportSuccess && (
                <div className="space-y-2">
                  <div className="text-violet-300 text-sm">
                    {jellyfinImportProgress}
                  </div>
                  {jellyfinImportPercent > 0 && jellyfinImportPercent < 100 && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-300"
                        style={{ width: `${jellyfinImportPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={importingJellyfin}
                className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 transition ${!importingJellyfin ? "hover:border-violet-400 hover:bg-violet-500/20" : ""} disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-violet-500/40 disabled:hover:bg-violet-500/10`}
              >
                {importingJellyfin ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Importing...
                  </>
                ) : (
                  "Import from Jellyfin"
                )}
              </button>
            </form>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700/50">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-white">
                Jellyfin scrobble sync
              </h2>
            </div>

            {loadingLiveSession ? (
              <p className="mb-4 text-sm text-zinc-400">
                Checking Jellyfin session...
              </p>
            ) : liveSession ? (
              <Link
                href={
                  liveSession.tmdbId
                    ? liveSession.seasonNumber && liveSession.episodeNumber
                      ? `/media/${liveSession.tmdbId}/season/${liveSession.seasonNumber}/episode/${liveSession.episodeNumber}?type=${liveSession.mediaType}`
                      : `/media/${liveSession.tmdbId}?type=${liveSession.mediaType}`
                    : "#"
                }
                className="mb-5 block overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/10 transition hover:border-emerald-400 hover:bg-emerald-500/20"
              >
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
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 [animation-duration:1.8s]" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
                      </span>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
                        Now playing
                      </p>
                    </div>
                    <p className="truncate text-lg font-bold text-white">
                      {liveSession.mediaType === "tv" ? (
                        <span
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/media/${liveSession.tmdbId}?type=tv`);
                          }}
                          className="hover:underline hover:text-violet-200 transition-colors cursor-pointer"
                        >
                          {liveSession.seriesName || liveSession.title}
                        </span>
                      ) : (
                        liveSession.title
                      )}
                    </p>
                    <p className="mt-1 text-sm">
                      {liveSession.mediaType === "tv" &&
                      liveSession.episodeLabel ? (
                        <>
                          <span className="text-emerald-200">
                            {liveSession.episodeLabel}
                          </span>
                          {" • "}
                          <span className="text-zinc-300">
                            {liveSession.episodeName || ""}
                          </span>
                        </>
                      ) : (
                        ""
                      )}
                    </p>
                    <p className="mt-1 text-sm">
                      <span className="text-emerald-200">
                        {liveSession.remainingMinutes > 0
                          ? `${liveSession.remainingMinutes} min left`
                          : "Finishing up"}
                      </span>
                      {" • "}
                      <span className="text-zinc-300">
                        Ends at{" "}
                        {(() => {
                          const endTime = new Date(
                            currentTime.getTime() +
                              liveSession.remainingMinutes * 60000,
                          );

                          return endTime.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          });
                        })()}
                      </span>
                    </p>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                        style={{
                          width: `${Math.min(100, Math.max(0, liveSession.percent))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ) : jellyfinConnected && jellyfinConfig.enabled ? (
              <p className="mb-5 text-sm text-zinc-400">
                No active Jellyfin session right now.
              </p>
            ) : null}

            <p className="text-zinc-400 mb-4">
              Connect your Jellyfin server so items Jellyfin marks as played,
              either manually or after playback completion, sync into this app
              as watched history. To set it up, create a webhook in Jellyfin
              with the URL{" "}
              <code className="break-all">
                https://traktlite.vercel.app/api/jellyfin/webhook
              </code>{" "}
              and
              send <code>UserDataSaved</code> events.
            </p>

            <p
              className={`mb-4 text-sm font-medium ${
                jellyfinConnected && jellyfinConfig.enabled
                  ? "text-green-400"
                  : "text-zinc-500"
              }`}
              role="status"
            >
              {jellyfinConnected && jellyfinConfig.enabled
                ? "Jellyfin scrobble is connected."
                : "Jellyfin scrobble is not connected."}
            </p>

            <form onSubmit={handleJellyfinSave} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Jellyfin server URL
                </label>
                <input
                  type="url"
                  value={jellyfinConfig.serverUrl}
                  onChange={(event) => {
                    setJellyfinConnected(false);
                    setJellyfinConfig((current) => ({
                      ...current,
                      serverUrl: event.target.value,
                    }));
                  }}
                  placeholder="https://jellyfin.example.com"
                  className="w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-base text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Jellyfin username
                </label>
                <input
                  type="text"
                  value={jellyfinConfig.username}
                  onChange={(event) => {
                    setJellyfinConnected(false);
                    setJellyfinConfig((current) => ({
                      ...current,
                      username: event.target.value,
                    }));
                  }}
                  placeholder="Your Jellyfin username"
                  className="w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-base text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Jellyfin API key
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  value={jellyfinConfig.apiKey}
                  onChange={(event) => {
                    setJellyfinConnected(false);
                    setJellyfinConfig((current) => ({
                      ...current,
                      apiKey: event.target.value,
                    }));
                  }}
                  placeholder={
                    hasSavedJellyfinApiKey
                      ? "••••••••••••"
                      : "Create an API key in Jellyfin Dashboard > API Keys"
                  }
                  className="w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-base text-white outline-none focus:border-violet-500"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Create an API key in Jellyfin Dashboard &gt; API Keys.
                </p>
              </div>

              <label className="flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={jellyfinConfig.enabled}
                  onChange={(event) => {
                    setJellyfinConnected(false);
                    setJellyfinConfig((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }));
                  }}
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
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-violet-500/40 disabled:hover:bg-violet-500/10"
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

          <section className="rounded-lg border border-red-500/50 bg-zinc-950/90 p-6 shadow-xl shadow-black/30 backdrop-blur-md">
            <h2 className="mb-2 text-xl font-bold text-red-200">Danger zone</h2>
            <p className="mb-6 text-sm leading-relaxed text-zinc-200">
              These actions are permanent. Erase your account data to keep your
              sign-in and start over, or delete your account completely.
            </p>

            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-lg border border-red-500/30 bg-zinc-900/90 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-white">Erase all account data</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                    Deletes your history, ratings, watchlist, Jellyfin
                    connection, profile details, and cached data. Your sign-in
                    account will remain.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAccountAction("reset");
                    setAccountConfirmation("");
                    setAccountError(null);
                    setAccountSuccess(null);
                  }}
                  disabled={accountBusy}
                  className="shrink-0 cursor-pointer rounded-full border border-orange-400/70 px-5 py-2.5 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Erase all data
                </button>
              </div>

              <div className="flex flex-col gap-4 rounded-lg border border-red-500/30 bg-zinc-900/90 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-white">Delete account</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                    Permanently erases your account data and deletes your
                    sign-in account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAccountAction("delete");
                    setAccountConfirmation("");
                    setAccountError(null);
                    setAccountSuccess(null);
                  }}
                  disabled={accountBusy}
                  className="shrink-0 cursor-pointer rounded-full border border-red-400/70 px-5 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete account
                </button>
              </div>
            </div>

            {accountSuccess && (
              <p className="mt-4 text-sm text-green-300" role="status">
                {accountSuccess}
              </p>
            )}
            {accountError && (
              <p className="mt-4 text-sm text-red-300" role="alert">
                {accountError}
              </p>
            )}

            {accountAction && (
              <form
                onSubmit={handleAccountAction}
                className="mt-5 space-y-3 rounded-lg border border-red-500/40 bg-zinc-900/90 p-4"
              >
                <label
                  htmlFor="account-confirmation"
                  className="block text-sm text-zinc-300"
                >
                  Type{" "}
                  <span className="font-bold text-white">
                    {accountAction === "reset" ? "RESET" : "DELETE"}
                  </span>{" "}
                  to confirm{" "}
                  {accountAction === "reset"
                    ? "erasing all account data"
                    : "permanently deleting your account"}
                  .
                </label>
                <input
                  id="account-confirmation"
                  value={accountConfirmation}
                  onChange={(event) =>
                    setAccountConfirmation(event.target.value)
                  }
                  autoComplete="off"
                  className="w-full rounded border border-zinc-500 bg-zinc-800 px-4 py-2 text-base text-white outline-none focus:border-red-400"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={
                      accountBusy ||
                      accountConfirmation.trim() !==
                        (accountAction === "reset" ? "RESET" : "DELETE")
                    }
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {accountBusy
                      ? "Processing..."
                      : accountAction === "reset"
                        ? "Erase my data"
                        : "Permanently delete account"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountAction(null);
                      setAccountConfirmation("");
                      setAccountError(null);
                    }}
                    disabled={accountBusy}
                    className="cursor-pointer rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </main>
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            id="sign-out-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-out-title"
            className="mx-4 w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
          >
            <h2 id="sign-out-title" className="mb-2 text-lg font-semibold text-white">
              Are you sure?
            </h2>
            <p className="mb-6 text-zinc-300">
              Do you really want to sign out?
            </p>
            {signOutError && (
              <p className="mb-4 text-sm text-red-300" role="alert">
                {signOutError}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                disabled={signingOut}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSignOut}
                disabled={signingOut}
                className="cursor-pointer rounded-lg bg-violet-600 px-4 py-2 text-sm text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
