/**
 * Skeletons, not spinners (CLAUDE.md quality bar).
 *
 * Each block matches the height of the real thing it stands in for, so nothing
 * shifts when the data lands. They do not pulse: the animation budget does not
 * cover it, and a still block reads as loading just as well.
 */

function Block({ className }: { className: string }) {
  return <div className={`ww-shimmer rounded-inner ${className}`} />;
}

export function HomeSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="page-gutter">
        <Block className="h-9 w-64" />
        <Block className="mt-3 h-5 w-32" />
      </div>

      {/* Dimensions mirror the real cards, so nothing shifts when data lands:
          the now card's 5.5rem figure, the nowcast's 3.25rem chart, and the
          rail's min(11.5rem, 52vw) cards. */}
      <div className="card mx-gutter p-5">
        <Block className="h-5 w-28" />
        <div className="mt-3 flex items-start justify-between gap-4">
          <Block className="h-[5.5rem] w-36" />
          <div className="flex flex-col gap-3 pt-3">
            <Block className="h-5 w-24" />
            <Block className="h-5 w-20" />
            <Block className="h-5 w-24" />
          </div>
        </div>
        <Block className="mt-4 h-5 w-full" />
      </div>

      <div className="card mx-gutter p-5">
        <Block className="h-3 w-20" />
        <Block className="mt-2 h-5 w-48" />
        <Block className="mt-4 h-[3.25rem] w-full" />
      </div>

      <Block className="mx-gutter h-10 rounded-pill" />

      <div className="page-gutter flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <Block
            key={index}
            className="h-[13.25rem] w-[min(11.5rem,52vw)] shrink-0 rounded-card"
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="page-gutter flex flex-col items-start gap-4 py-10">
      <p className="text-base">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="type-label rounded-pill border border-border px-5 py-2 text-xs"
      >
        Try again
      </button>
    </div>
  );
}
