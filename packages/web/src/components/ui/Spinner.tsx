import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpinnerProps {
  /** Size of the spinner */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Color variant */
  variant?: 'primary' | 'white' | 'slate';
  /** Additional class names */
  className?: string;
  /** Accessible label */
  label?: string;
}

// ---------------------------------------------------------------------------
// Size & color maps
// ---------------------------------------------------------------------------

const sizeClasses: Record<string, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const colorClasses: Record<string, { track: string; spinner: string }> = {
  primary: {
    track: 'text-primary-200 dark:text-primary-900',
    spinner: 'text-primary-600 dark:text-primary-400',
  },
  white: {
    track: 'text-white/25',
    spinner: 'text-white',
  },
  slate: {
    track: 'text-slate-200 dark:text-slate-700',
    spinner: 'text-slate-600 dark:text-slate-300',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Spinner({
  size = 'md',
  variant = 'primary',
  className,
  label = 'Loading',
}: SpinnerProps) {
  const colors = colorClasses[variant];

  return (
    <div
      className={cn('inline-flex items-center justify-center', className)}
      role="status"
      aria-label={label}
    >
      <svg
        className={cn('animate-spin', sizeClasses[size])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className={cn('opacity-25', colors.track)}
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className={colors.spinner}
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
