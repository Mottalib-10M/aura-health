import { useState } from 'react';
import { Bell, Calendar, AlertTriangle, CheckCircle, FlaskConical, Activity, X, Check } from 'lucide-react';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string;
  type: 'appointment' | 'alert' | 'result' | 'system' | 'telemetry';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'appointment',
    title: 'Upcoming Appointment',
    message: 'Your appointment with Dr. Karimov is tomorrow at 10:00 AM.',
    timestamp: '2026-05-14T10:00:00Z',
    read: false,
  },
  {
    id: '2',
    type: 'result',
    title: 'Lab Results Ready',
    message: 'Your HbA1c and lipid panel results are now available.',
    timestamp: '2026-05-14T08:30:00Z',
    read: false,
  },
  {
    id: '3',
    type: 'telemetry',
    title: 'Heart Rate Anomaly',
    message: 'An elevated heart rate of 112 bpm was detected during rest.',
    timestamp: '2026-05-13T22:15:00Z',
    read: false,
  },
  {
    id: '4',
    type: 'system',
    title: 'Profile Updated',
    message: 'Your privacy settings have been updated successfully.',
    timestamp: '2026-05-13T14:00:00Z',
    read: true,
  },
  {
    id: '5',
    type: 'appointment',
    title: 'Appointment Confirmed',
    message: 'Your telemedicine appointment with Dr. Yusupova has been confirmed.',
    timestamp: '2026-05-12T16:30:00Z',
    read: true,
  },
];

// ---------------------------------------------------------------------------
// Icon by type
// ---------------------------------------------------------------------------

const typeIcons = {
  appointment: Calendar,
  alert: AlertTriangle,
  result: FlaskConical,
  system: CheckCircle,
  telemetry: Activity,
};

const typeColors = {
  appointment: 'bg-blue-50 text-blue-500 dark:bg-blue-950 dark:text-blue-400',
  alert: 'bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400',
  result: 'bg-purple-50 text-purple-500 dark:bg-purple-950 dark:text-purple-400',
  system: 'bg-green-50 text-green-500 dark:bg-green-950 dark:text-green-400',
  telemetry: 'bg-amber-50 text-amber-500 dark:bg-amber-950 dark:text-amber-400',
};

// ---------------------------------------------------------------------------
// Time Formatter
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState(mockNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'absolute right-0 top-full z-50 mt-1 w-96 rounded-xl border border-slate-200 bg-white shadow-xl',
          'dark:border-slate-700 dark:bg-slate-800',
        )}
        role="dialog"
        aria-label="Notifications"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-2xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950"
              >
                <Check className="mr-1 inline h-3 w-3" />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center py-10">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                <Bell className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                No notifications
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = typeIcons[notification.type];
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markAsRead(notification.id)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors',
                    'hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-800/50',
                    !notification.read && 'bg-primary-50/30 dark:bg-primary-950/20',
                  )}
                >
                  <div className={cn('mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', typeColors[notification.type])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        'text-xs truncate',
                        notification.read
                          ? 'font-medium text-slate-700 dark:text-slate-300'
                          : 'font-semibold text-slate-900 dark:text-slate-100',
                      )}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-2xs text-slate-400 dark:text-slate-500">
                      {formatRelativeTime(notification.timestamp)}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-slate-100 p-2 dark:border-slate-700">
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-center text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950"
            >
              View All Notifications
            </button>
          </div>
        )}
      </div>
    </>
  );
}
