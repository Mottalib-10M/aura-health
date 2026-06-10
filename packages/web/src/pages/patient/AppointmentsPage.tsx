import { useState, useMemo } from 'react';
import { CalendarDays, Clock, Plus, Calendar, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useAppointments, type AppointmentRow } from '@/hooks/useAppointments';

// ---------------------------------------------------------------------------
// Status Config
// ---------------------------------------------------------------------------

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'info' | 'error' | 'default'; label: string }> = {
  CONFIRMED: { variant: 'success', label: 'Confirmed' },
  SCHEDULED: { variant: 'warning', label: 'Pending' },
  COMPLETED: { variant: 'info', label: 'Completed' },
  CANCELLED: { variant: 'error', label: 'Cancelled' },
  CHECKED_IN: { variant: 'success', label: 'Checked In' },
  IN_PROGRESS: { variant: 'info', label: 'In Progress' },
  NO_SHOW: { variant: 'error', label: 'No Show' },
};

// ---------------------------------------------------------------------------
// Appointment Card
// ---------------------------------------------------------------------------

function AppointmentCard({
  appointment,
  onCancel,
  isCancelling,
}: {
  appointment: AppointmentRow;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}) {
  const status = statusConfig[appointment.status] ?? { variant: 'default' as const, label: appointment.status };
  const isUpcoming = ['SCHEDULED', 'CONFIRMED'].includes(appointment.status);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Dr. {appointment.doctor?.firstName} {appointment.doctor?.lastName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {appointment.doctor?.specialty ?? 'General Practice'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(appointment.scheduledAt).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(appointment.scheduledAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {appointment.reason && (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {appointment.reason}
                </p>
              )}
            </div>
          </div>
          <Badge variant={status.variant} dot>
            {status.label}
          </Badge>
        </div>
        {isUpcoming && (
          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            <Button
              variant="outline"
              size="sm"
              className="text-red-600"
              onClick={() => onCancel(appointment.id)}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function AppointmentsPage() {
  const user = useAuthStore((s) => s.user);
  const patientId = user?.id ?? '';

  const { appointments, isLoading, cancelAppointment, isCancelling } = useAppointments(patientId);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const upcoming = useMemo(
    () => appointments.filter((a) => ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(a.status)),
    [appointments],
  );
  const past = useMemo(
    () => appointments.filter((a) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status)),
    [appointments],
  );

  const displayed = activeTab === 'upcoming' ? upcoming : past;

  const handleCancel = (appointmentId: string) => {
    cancelAppointment({ appointmentId, reason: 'Cancelled by patient' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Appointments</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your medical appointments
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
        {(['upcoming', 'past'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-primary-600 text-white'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700',
            )}
          >
            {tab === 'upcoming' ? 'Upcoming' : 'Past'}
            <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
              {tab === 'upcoming' ? upcoming.length : past.length}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Calendar className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {activeTab === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Appointments'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeTab === 'upcoming'
              ? 'Your scheduled appointments will appear here.'
              : 'Your completed appointments will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {displayed.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onCancel={handleCancel}
              isCancelling={isCancelling}
            />
          ))}
        </div>
      )}
    </div>
  );
}
