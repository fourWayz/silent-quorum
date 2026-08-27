export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <div className="mb-10 h-20 w-full max-w-xl animate-pulse rounded-lg bg-ink-800" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-[var(--radius-lg)] bg-ink-800" />
        ))}
      </div>
    </div>
  );
}
