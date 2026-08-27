export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="mb-10 h-20 w-full max-w-xl animate-pulse rounded-lg bg-ink-800" />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="h-48 animate-pulse rounded-[var(--radius-lg)] bg-ink-800" />
        <div className="h-64 animate-pulse rounded-[var(--radius-lg)] bg-ink-800" />
      </div>
    </div>
  );
}
