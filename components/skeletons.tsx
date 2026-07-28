/**
 * Skeletons, not spinners (CLAUDE.md quality bar).
 *
 * Each block matches the height of the real thing it stands in for, so nothing
 * shifts when the data lands. They do not pulse: the animation budget does not
 * cover it, and a still block reads as loading just as well.
 */

function Block({ className }: { className: string }) {
  return <div className={`rounded-inner bg-surface-raised ${className}`} />;
}

export function HomeSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="px-5">
        <Block className="h-9 w-64" />
        <Block className="mt-3 h-5 w-32" />
      </div>

      <div className="mx-5 rounded-card bg-surface p-5">
        <Block className="h-5 w-28" />
        <div className="mt-3 flex items-start justify-between gap-4">
          <Block className="h-20 w-36" />
          <div className="flex flex-col gap-3 pt-3">
            <Block className="h-5 w-24" />
            <Block className="h-5 w-20" />
            <Block className="h-5 w-24" />
          </div>
        </div>
        <Block className="mt-4 h-5 w-full" />
      </div>

      <Block className="mx-5 h-10 rounded-pill" />

      <div className="flex gap-3 overflow-hidden px-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Block key={index} className="h-[8.5rem] w-[5.5rem] shrink-0" />
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
    <div className="flex flex-col items-start gap-4 px-5 py-10">
      <p className="text-base">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="type-label rounded-pill border border-hairline px-5 py-2 text-xs"
      >
        Try again
      </button>
    </div>
  );
}
