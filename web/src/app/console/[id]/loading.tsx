export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <div className="mb-8 h-4 w-24 animate-pulse rounded bg-ink-800" />
      <div className="mb-10 h-24 w-full max-w-xl animate-pulse rounded-lg bg-ink-800" />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[auto_1fr]">
        <div className="mx-auto h-[340px] w-[340px] animate-pulse rounded-full bg-ink-800" />
        <div className="h-64 animate-pulse rounded-lg bg-ink-800" />
      </div>
    </div>
  );
}
