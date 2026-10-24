import { createContext, useContext, Component, ReactNode } from 'react';
import { RouteError } from './RouteError';

/**
 * Context that exposes the current route retry key and a retry function so
 * that lazy route wrappers can force a fresh dynamic import on retry.
 */

interface RouteRetryContextValue {
  retryKey: number;
  retry: () => void;
}

export const RouteRetryContext = createContext<RouteRetryContextValue | null>(null);

export function useRouteRetry(): RouteRetryContextValue {
  const context = useContext(RouteRetryContext);
  if (!context) {
    throw new Error('useRouteRetry must be used within a RouteErrorBoundary');
  }
  return context;
}

/**
 * Error boundary for lazy routes.
 *
 * Catches rendering failures (including dynamic-import / chunk-load errors)
 * thrown by lazy route components, shows a recovery UI with a Retry button,
 * and on retry resets the error and bumps the retry key so that lazy route
 * wrappers perform a fresh dynamic import instead of reusing a cached
 * rejected promise.
 *
 * Retry is user-initiated only, so a persistently failing route does not
 * cause an endless reload loop.
 */

export class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; retryKey: number }
> {
  state = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  retry = () => {
    this.setState((prev) => ({ error: null, retryKey: prev.retryKey + 1 }));
  };

  render() {
    const { error, retryKey } = this.state;
    const { children } = this.props;
    const value = { retryKey, retry: this.retry };

    if (error) {
      return (
        <RouteRetryContext.Provider value={value}>
          <RouteError onRetry={this.retry} />
        </RouteRetryContext.Provider>
      );
    }

    return <RouteRetryContext.Provider value={value}>{children}</RouteRetryContext.Provider>;
  }
}
