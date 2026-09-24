"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importProgress, setImportProgress] = useState<string>("");
  const [exportProgress, setExportProgress] = useState<string>("");
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
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
      <div className="flex flex-col flex-1 items-center justify-center font-sans min-h-screen bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    router.push("/auth");
    return null;
  }

  return (
    <div className="flex flex-col flex-1 font-sans min-h-screen bg-black">
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

        <div className="space-y-8">
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700/50">
            <h2 className="text-xl font-bold text-white mb-4">Import Watch Data</h2>
            <p className="text-zinc-400 mb-4">
              Import your watch history from a Trakt export file. This will replace all existing data.
            </p>
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-zinc-300 mb-2">Select Trakt Export File (.zip)</label>
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
                className="px-6 py-3 cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Importing...
                  </>
                ) : (
                  "Import Data"
                )}
              </button>
            </form>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700/50">
            <h2 className="text-xl font-bold text-white mb-4">Export Watch Data</h2>
            <p className="text-zinc-400 mb-4">
              Export all your watch history in Trakt format as a .zip file.
            </p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-6 py-3 cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
