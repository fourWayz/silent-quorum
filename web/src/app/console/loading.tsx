export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="mb-10 h-20 w-full max-w-xl animate-pulse rounded-lg bg-ink-800" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-[var(--radius-lg)] bg-ink-800" />
        ))}
      </div>
    </div>
  );
}
