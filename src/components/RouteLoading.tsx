/**
 * Visible loading state for lazy routes.
 *
 * Renders inside the application shell so the header and overall page
 * dimensions stay stable while a dynamic import is in flight. The fixed
 * min-height prevents the content area from collapsing and shifting layout.
 */

export function RouteLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading page"
      className="flex min-h-screen flex-col items-center justify-center pt-24 text-center"
    >
      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-none border border-outline-variant">
        <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            fill="currentColor"
          />
        </svg>
      </div>
      <p className="mt-3 font-body text-[13px] text-outline">Loading page…</p>
    </div>
  );
}
