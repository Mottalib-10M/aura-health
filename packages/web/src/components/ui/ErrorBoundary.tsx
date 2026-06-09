import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // In production, this would send to an error reporting service
    console.error('[Uzavita] Uncaught error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-800">
            {/* Icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>

            {/* Heading */}
            <h1 className="mb-2 text-center text-xl font-bold text-slate-900 dark:text-slate-100">
              Something went wrong
            </h1>
            <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
              An unexpected error occurred in the Uzavita application. Please try again or return to the home page.
            </p>

            {/* Error details in dev mode */}
            {isDev && this.state.error && (
              <div className="mb-6 max-h-48 overflow-auto rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/50">
                <p className="mb-1 text-xs font-semibold text-red-700 dark:text-red-300">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="whitespace-pre-wrap text-2xs text-red-600 dark:text-red-400">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Home className="h-4 w-4" />
                Go Home
              </Link>
            </div>

            {/* Branding */}
            <div className="mt-8 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-600">
                <span className="text-xs font-bold text-white">U</span>
              </div>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Uzavita
              </span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
