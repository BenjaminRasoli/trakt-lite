"use client";

import { useState, useEffect } from "react";
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
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      setUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
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
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80">
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
        </div>
      </main>
    </div>
  );
}
