"use client";

import { useEffect } from "react";

interface DropNextUpShowModalProps {
  showTitle: string | null;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DropNextUpShowModal({
  showTitle,
  loading = false,
  error,
  onCancel,
  onConfirm,
}: DropNextUpShowModalProps) {
  useEffect(() => {
    if (!showTitle) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [showTitle, loading, onCancel]);

  if (!showTitle) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="drop-next-up-title"
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
      >
        <h2
          id="drop-next-up-title"
          className="mb-2 text-xl font-bold text-white"
        >
          Drop show from Next Up?
        </h2>
        <p className="mb-4 text-zinc-300">
          Are you sure you want to drop{" "}
          <span className="font-semibold text-white">{showTitle}</span> from
          Next Up?
        </p>
        {error && (
          <p role="alert" className="mb-4 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Dropping..." : "Drop show"}
          </button>
        </div>
      </section>
    </div>
  );
}
