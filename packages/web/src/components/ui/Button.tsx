import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg',
    'text-sm font-medium transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'dark:focus-visible:ring-offset-slate-900',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-primary-600 text-white shadow-sm hover:bg-primary-700 active:bg-primary-800',
        secondary:
          'bg-secondary-600 text-white shadow-sm hover:bg-secondary-700 active:bg-secondary-800',
        danger:
          'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
        ghost:
          'text-slate-700 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-700',
        outline:
          'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
        link:
          'text-primary-600 underline-offset-4 hover:underline dark:text-primary-400',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-md',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-lg rounded-xl',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as a child component (e.g., a Link) */
  asChild?: boolean;
  /** Show a loading spinner */
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        <>
          {loading && (
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
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
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {children}
        </>
      </Comp>
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
