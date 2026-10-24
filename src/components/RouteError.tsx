import { useCallback } from 'react';

/**
 * Presentational error UI shown when a lazy route fails to load.
 *
 * Displays a clear, user-friendly message and a Retry button that lets the
 * user recover without refreshing the whole application.
 */

export function RouteError({ onRetry }: { onRetry: () => void }) {
  const handleRetry = useCallback(() => onRetry(), [onRetry]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center pt-24 text-center"
    >
      <h2 className="font-heading text-[22px] font-bold tracking-[-0.5px] text-on-surface">
        Failed to load page
      </h2>
      <p className="mt-3 max-w-[420px] font-body text-[14px] leading-[1.6] text-on-surface-variant">
        We couldn’t load this page. It may be a temporary network issue or a failed chunk.
      </p>
      <button
        type="button"
        onClick={handleRetry}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-none border border-primary bg-transparent px-5 font-heading text-[12px] font-semibold uppercase tracking-[1.5px] text-primary transition-colors hover:bg-primary/10 hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
        Retry
      </button>
    </div>
  );
}
