export default function CalendarLoading() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-black">
      <div className="flex items-center gap-3 text-violet-300">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
        <span className="text-sm font-medium uppercase tracking-[0.2em]">
          Loading
        </span>
      </div>
    </div>
  );
}
