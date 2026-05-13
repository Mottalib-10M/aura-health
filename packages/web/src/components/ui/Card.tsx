import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Card Root
// ---------------------------------------------------------------------------

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Enable hover elevation effect */
  hoverable?: boolean;
  /** Add a colored left border indicator */
  accentColor?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success';
}

const accentStyles: Record<string, string> = {
  primary: 'border-l-4 border-l-primary-500',
  secondary: 'border-l-4 border-l-secondary-500',
  danger: 'border-l-4 border-l-red-500',
  warning: 'border-l-4 border-l-amber-500',
  success: 'border-l-4 border-l-green-500',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, accentColor, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-card',
        'dark:border-slate-700 dark:bg-slate-800',
        hoverable && 'transition-shadow duration-200 hover:shadow-card-hover cursor-pointer',
        accentColor && accentStyles[accentColor],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

// ---------------------------------------------------------------------------
// Card Header
// ---------------------------------------------------------------------------

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-5 pb-3', className)}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

// ---------------------------------------------------------------------------
// Card Title
// ---------------------------------------------------------------------------

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-base font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100', className)}
      {...props}
    >
      {children}
    </h3>
  ),
);
CardTitle.displayName = 'CardTitle';

// ---------------------------------------------------------------------------
// Card Description
// ---------------------------------------------------------------------------

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-slate-500 dark:text-slate-400', className)}
      {...props}
    />
  ),
);
CardDescription.displayName = 'CardDescription';

// ---------------------------------------------------------------------------
// Card Content
// ---------------------------------------------------------------------------

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-5 pt-0', className)}
      {...props}
    />
  ),
);
CardContent.displayName = 'CardContent';

// ---------------------------------------------------------------------------
// Card Footer
// ---------------------------------------------------------------------------

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-3 border-t border-slate-100 px-5 py-3',
        'dark:border-slate-700',
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
