import { Suspense, lazy, useMemo } from 'react';
import { RouteLoading } from './RouteLoading';
import { useRouteRetry } from './RouteErrorBoundary';

/**
 * Renders a lazily-loaded route component.
 *
 * A fresh `lazy()` is created whenever the retry key changes (via
 * `RouteErrorBoundary`), which forces a new dynamic import instead of
 * reusing a browser-cached rejected promise. The component is wrapped in
 * `Suspense` so a visible loading state is shown while the import is in
 * flight.
 */

export function LazyRoute({ loader }: { loader: () => Promise<{ default: React.ComponentType }> }) {
  const { retryKey } = useRouteRetry();
  const LazyComponent = useMemo(() => lazy(loader), [loader, retryKey]);

  return (
    <Suspense fallback={<RouteLoading />}>
      <LazyComponent key={retryKey} />
    </Suspense>
  );
}
