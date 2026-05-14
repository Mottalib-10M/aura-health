import { useState } from 'react';
import { CalendarDays, Clock, User, Plus, Calendar, Video, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface AppointmentData {
  id: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  type: 'in-person' | 'telemedicine';
  location?: string;
}

const mockUpcoming: AppointmentData[] = [
  {
    id: '1',
    doctorName: 'Dr. Alisher Karimov',
    specialty: 'Cardiology',
    date: '2026-05-20',
    time: '10:00 AM',
    status: 'confirmed',
    type: 'in-person',
    location: 'Tashkent Medical Center, Room 302',
  },
  {
    id: '2',
    doctorName: 'Dr. Nilufar Yusupova',
    specialty: 'General Practice',
    date: '2026-05-22',
    time: '2:30 PM',
    status: 'pending',
    type: 'telemedicine',
  },
  {
    id: '3',
    doctorName: 'Dr. Sardor Rakhimov',
    specialty: 'Endocrinology',
    date: '2026-05-28',
    time: '11:00 AM',
    status: 'confirmed',
    type: 'in-person',
    location: 'National Endocrinology Center',
  },
];

const mockPast: AppointmentData[] = [
  {
    id: '4',
    doctorName: 'Dr. Alisher Karimov',
    specialty: 'Cardiology',
    date: '2026-04-15',
    time: '9:00 AM',
    status: 'completed',
    type: 'in-person',
    location: 'Tashkent Medical Center, Room 302',
  },
  {
    id: '5',
    doctorName: 'Dr. Nilufar Yusupova',
    specialty: 'General Practice',
    date: '2026-04-02',
    time: '3:00 PM',
    status: 'completed',
    type: 'telemedicine',
  },
  {
    id: '6',
    doctorName: 'Dr. Javlon Mirzayev',
    specialty: 'Dermatology',
    date: '2026-03-20',
    time: '1:00 PM',
    status: 'cancelled',
    type: 'in-person',
    location: 'City Clinic #5',
  },
];

// ---------------------------------------------------------------------------
// Status Config
// ---------------------------------------------------------------------------

const statusConfig: Record<AppointmentData['status'], { variant: 'success' | 'warning' | 'info' | 'error'; label: string }> = {
  confirmed: { variant: 'success', label: 'Confirmed' },
  pending: { variant: 'warning', label: 'Pending' },
  completed: { variant: 'info', label: 'Completed' },
  cancelled: { variant: 'error', label: 'Cancelled' },
};

// ---------------------------------------------------------------------------
// Appointment Card
// ---------------------------------------------------------------------------

function AppointmentCard({ appointment }: { appointment: AppointmentData }) {
  const status = statusConfig[appointment.status];

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
              appointment.type === 'telemedicine'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                : 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
            )}>
              {appointment.type === 'telemedicine' ? (
                <Video className="h-5 w-5" />
              ) : (
                <MapPin className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {appointment.doctorName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {appointment.specialty}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(appointment.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {appointment.time}
                </span>
              </div>
              {appointment.location && (
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <MapPin className="h-3 w-3" />
                  {appointment.location}
                </p>
              )}
            </div>
          </div>
          <Badge variant={status.variant} dot>
            {status.label}
          </Badge>
        </div>
        {appointment.status === 'confirmed' && appointment.type === 'telemedicine' && (
          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
            <Button variant="primary" size="sm" className="w-full">
              <Video className="h-4 w-4" />
              Join Video Call
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ tab }: { tab: 'upcoming' | 'past' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Calendar className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {tab === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Appointments'}
      </h3>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        {tab === 'upcoming'
          ? 'Schedule a new appointment to get started.'
          : 'Your completed appointments will appear here.'}
      </p>
      {tab === 'upcoming' && (
        <Button variant="primary" size="sm">
          <Plus className="h-4 w-4" />
          Book Appointment
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function AppointmentsPage() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [isLoading] = useState(false);

  const appointments = activeTab === 'upcoming' ? mockUpcoming : mockPast;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Appointments
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your medical appointments
          </p>
        </div>
        <Button variant="primary">
          <Plus className="h-4 w-4" />
          Book New Appointment
        </Button>
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
              {tab === 'upcoming' ? mockUpcoming.length : mockPast.length}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )}
    </div>
  );
}
