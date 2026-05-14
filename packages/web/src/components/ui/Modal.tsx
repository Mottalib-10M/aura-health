import { type ReactNode, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal description for accessibility */
  description?: string;
  /** Modal content */
  children: ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether clicking the overlay closes the modal */
  closeOnOverlayClick?: boolean;
  /** Whether pressing Escape closes the modal */
  closeOnEscape?: boolean;
  /** Additional className for the modal panel */
  className?: string;
  /** Footer content */
  footer?: ReactNode;
}

// ---------------------------------------------------------------------------
// Size map
// ---------------------------------------------------------------------------

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
};

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
  footer,
}: ModalProps) {
  // Handle Escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEscape, onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          aria-describedby={description ? 'modal-description' : undefined}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={closeOnOverlayClick ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            className={cn(
              'relative z-10 w-full overflow-hidden rounded-2xl bg-white shadow-xl',
              'dark:bg-slate-800 dark:border dark:border-slate-700',
              sizeClasses[size],
              className,
            )}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
                <div>
                  {title && (
                    <h2
                      id="modal-title"
                      className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p
                      id="modal-description"
                      className="mt-1 text-sm text-slate-500 dark:text-slate-400"
                    >
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    'rounded-lg p-1.5 text-slate-400 transition-colors',
                    'hover:bg-slate-100 hover:text-slate-600',
                    'dark:hover:bg-slate-700 dark:hover:text-slate-300',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  )}
                  aria-label="Close dialog"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-6 py-4">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-700">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
