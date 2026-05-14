import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let toastCounter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, duration: toast.duration ?? 5000 }],
    }));
    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearAll: () => set({ toasts: [] }),
}));

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  const removeToast = useToastStore((s) => s.removeToast);

  return {
    addToast: useCallback(
      (toast: Omit<Toast, 'id'>) => addToast(toast),
      [addToast],
    ),
    removeToast: useCallback(
      (id: string) => removeToast(id),
      [removeToast],
    ),
    success: useCallback(
      (title: string, message?: string) =>
        addToast({ type: 'success', title, message }),
      [addToast],
    ),
    error: useCallback(
      (title: string, message?: string) =>
        addToast({ type: 'error', title, message, duration: 8000 }),
      [addToast],
    ),
    warning: useCallback(
      (title: string, message?: string) =>
        addToast({ type: 'warning', title, message }),
      [addToast],
    ),
    info: useCallback(
      (title: string, message?: string) =>
        addToast({ type: 'info', title, message }),
      [addToast],
    ),
  };
}

// ---------------------------------------------------------------------------
// Toast Item Component
// ---------------------------------------------------------------------------

const typeConfig = {
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50 dark:bg-green-950/80',
    border: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-500',
    titleColor: 'text-green-800 dark:text-green-200',
    messageColor: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50 dark:bg-red-950/80',
    border: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-500',
    titleColor: 'text-red-800 dark:text-red-200',
    messageColor: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-950/80',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-800 dark:text-amber-200',
    messageColor: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-950/80',
    border: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-800 dark:text-blue-200',
    messageColor: 'text-blue-600 dark:text-blue-400',
  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const config = typeConfig[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(() => removeToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur-sm',
        config.bg,
        config.border,
      )}
      role="alert"
      aria-live="assertive"
    >
      <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', config.iconColor)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', config.titleColor)}>{toast.title}</p>
        {toast.message && (
          <p className={cn('mt-0.5 text-xs', config.messageColor)}>{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className={cn(
          'flex-shrink-0 rounded-md p-1 transition-colors',
          'hover:bg-black/5 dark:hover:bg-white/10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        )}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4 text-slate-400" />
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Toast Provider
// ---------------------------------------------------------------------------

export function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
