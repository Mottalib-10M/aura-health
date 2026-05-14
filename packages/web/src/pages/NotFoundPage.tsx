import { Link } from 'react-router-dom';
import { Cross, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// 404 Not Found Page
// ---------------------------------------------------------------------------

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        {/* Medical Cross Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950">
          <Cross className="h-10 w-10 text-primary-500" />
        </div>

        {/* Heading */}
        <h1 className="mb-2 text-4xl font-bold text-slate-900 dark:text-slate-100">
          404
        </h1>
        <h2 className="mb-3 text-lg font-semibold text-slate-700 dark:text-slate-300">
          Page Not Found
        </h2>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Please check
          the URL or navigate back to the dashboard.
        </p>

        {/* Action */}
        <Link to="/">
          <Button variant="primary" size="lg">
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </Link>

        {/* Branding */}
        <div className="mt-12 flex items-center justify-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-600">
            <span className="text-xs font-bold text-white">A</span>
          </div>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
            Aura Health
          </span>
        </div>
      </div>
    </div>
  );
}
