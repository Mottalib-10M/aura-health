import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { gqlRequest } from '@/services/api';
import { GET_DOCTOR_APPOINTMENTS } from '@/services/graphql/queries';
import { CREATE_APPOINTMENT, MANAGE_DOCTOR_SCHEDULE } from '@/services/graphql/mutations';
import type { AppointmentRow } from '@/hooks/useSchedule';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const weekDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1 + offset * 7);
  return weekDayNames.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// ---------------------------------------------------------------------------
// Slot Cell
// ---------------------------------------------------------------------------

function SlotCell({
  appointment,
  onClick,
}: {
  appointment?: AppointmentRow;
  onClick: () => void;
}) {
  if (!appointment) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex h-full w-full min-h-[3rem] items-center justify-center rounded-lg border border-dashed border-slate-200 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:hover:border-primary-700 dark:hover:bg-primary-950 cursor-pointer"
      >
        <Plus className="h-4 w-4 text-slate-300 transition-colors group-hover:text-primary-500 dark:text-slate-600" />
      </button>
    );
  }

  return (
    <div className="flex h-full min-h-[3rem] flex-col justify-between rounded-lg border border-green-200 bg-green-50 p-2 text-xs transition-shadow hover:shadow-md dark:border-green-800 dark:bg-green-950/50">
      <div>
        <p className="font-medium text-green-800 dark:text-green-200">
          {appointment.patient?.firstName} {appointment.patient?.lastName}
        </p>
        <p className="mt-0.5 text-green-600 dark:text-green-400 truncate">
          {appointment.reason ?? 'Appointment'}
        </p>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="flex items-center gap-0.5">
          <MapPin className="h-3 w-3 text-green-500" />
          <span className="text-green-600 dark:text-green-400">In-person</span>
        </span>
        <Badge
          variant={appointment.status === 'CONFIRMED' ? 'success' : appointment.status === 'COMPLETED' ? 'default' : 'warning'}
          size="sm"
        >
          {appointment.status}
        </Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Book Modal
// ---------------------------------------------------------------------------

function QuickBookModal({
  open,
  onClose,
  doctorId,
  date,
  time,
}: {
  open: boolean;
  onClose: () => void;
  doctorId: string;
  date: string;
  time: string;
}) {
  const queryClient = useQueryClient();
  const [patientSearch, setPatientSearch] = useState('');
  const [reason, setReason] = useState('');

  // Search patients
  const patientsQuery = useQuery({
    queryKey: ['searchPatients', doctorId],
    queryFn: () =>
      gqlRequest<{ doctorPatients: Array<{ id: string; firstName: string; lastName: string; auraId: string }> }>(
        `query($doctorId: ID!) { doctorPatients(doctorId: $doctorId) { id firstName lastName auraId } }`,
        { doctorId },
      ),
    enabled: open && !!doctorId,
  });

  const patients = patientsQuery.data?.doctorPatients ?? [];
  const filteredPatients = patientSearch
    ? patients.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase()) ||
          p.auraId.toLowerCase().includes(patientSearch.toLowerCase()),
      )
    : patients;

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      gqlRequest<{ createAppointment: unknown }>(CREATE_APPOINTMENT, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorAppointments'] });
      onClose();
      setSelectedPatientId(null);
      setReason('');
      setPatientSearch('');
    },
  });

  const handleBook = () => {
    if (!selectedPatientId) return;
    createMutation.mutate({
      patientId: selectedPatientId,
      doctorId,
      specialty: 'general',
      preferredDate: date,
      preferredTimeStart: time,
      preferredTimeEnd: `${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:00`,
      urgencyLevel: 'NON_URGENT',
      reason: reason || 'Consultation',
    });
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book Appointment"
      description={`${date} at ${time}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleBook}
            disabled={!selectedPatientId || createMutation.isPending}
          >
            {createMutation.isPending ? 'Booking...' : 'Book Appointment'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {createMutation.isError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Failed to create appointment. Please try again.
          </div>
        )}

        {/* Patient selection */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Patient <span className="text-red-500">*</span>
          </label>
          {selectedPatient ? (
            <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-950">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </p>
                <p className="text-xs text-slate-500">{selectedPatient.auraId}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPatientId(null)}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search patient by name..."
                className={cn(
                  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
                  'text-slate-900 placeholder:text-slate-400',
                  'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
                  'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
                )}
              />
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {patientsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner size="sm" />
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <p className="p-3 text-center text-xs text-slate-400">No patients found</p>
                ) : (
                  filteredPatients.slice(0, 10).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(p.id);
                        setPatientSearch('');
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{p.auraId}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Reason
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Follow-up checkup, Lab results..."
            className={cn(
              'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
              'text-slate-900 placeholder:text-slate-400',
              'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500',
              'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
            )}
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function SchedulePage() {
  const user = useAuthStore((s) => s.user);
  const doctorId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDay, setAddDay] = useState(1);
  const [addStart, setAddStart] = useState('09:00');
  const [addEnd, setAddEnd] = useState('17:00');

  // Quick book state
  const [bookSlot, setBookSlot] = useState<{ date: string; time: string } | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // Fetch appointments for ALL days of the week (no date filter = all appointments)
  const appointmentsQuery = useQuery({
    queryKey: ['doctorAppointments', doctorId, weekOffset],
    queryFn: async () => {
      // Fetch without date filter to get all appointments, then filter client-side
      const data = await gqlRequest<{ doctorAppointments: AppointmentRow[] }>(
        GET_DOCTOR_APPOINTMENTS,
        { doctorId },
      );
      return data;
    },
    enabled: !!doctorId,
  });

  const appointments = appointmentsQuery.data?.doctorAppointments ?? [];

  const manageScheduleMutation = useMutation({
    mutationFn: (input: { doctorId: string; dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }) =>
      gqlRequest<{ manageDoctorSchedule: boolean }>(MANAGE_DOCTOR_SCHEDULE, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorSchedule', doctorId] });
    },
  });

  // Build a map: dayIndex -> hourIndex -> appointment
  const slotMap = useMemo(() => {
    const map: Record<string, AppointmentRow> = {};
    for (const apt of appointments) {
      const aptDate = new Date(apt.scheduledAt);
      const dateStr = aptDate.toISOString().slice(0, 10);
      const dayIdx = weekDates.findIndex(d => d.toISOString().slice(0, 10) === dateStr);
      if (dayIdx === -1) continue;
      // Skip cancelled
      if (apt.status === 'CANCELLED') continue;
      const hour = aptDate.getHours();
      map[`${dayIdx}-${hour}`] = apt;
    }
    return map;
  }, [appointments, weekDates]);

  const weekLabel = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[4].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const handleAddAvailability = useCallback(() => {
    manageScheduleMutation.mutate({
      doctorId,
      dayOfWeek: addDay,
      startTime: addStart,
      endTime: addEnd,
      isAvailable: true,
    });
    setShowAddModal(false);
  }, [doctorId, addDay, addStart, addEnd, manageScheduleMutation]);

  const handleSlotClick = (dayIdx: number, hour: string) => {
    const date = weekDates[dayIdx].toISOString().slice(0, 10);
    setBookSlot({ date, time: hour });
  };

  if (appointmentsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Schedule</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your weekly appointment calendar
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add Availability
        </Button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{weekLabel}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-900" />
          Appointment
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-dashed border-slate-300 dark:border-slate-600" />
          Click + to book
        </span>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="w-20 px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <Clock className="h-4 w-4" />
                  </th>
                  {weekDayNames.map((day, i) => (
                    <th key={day} className="px-2 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span className="block">{day}</span>
                      <span className="text-slate-400 dark:text-slate-500">
                        {weekDates[i].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((hour) => {
                  const hourNum = parseInt(hour);
                  return (
                    <tr key={hour} className="border-b border-slate-50 dark:border-slate-800">
                      <td className="px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">{hour}</td>
                      {weekDayNames.map((_, dayIdx) => {
                        const apt = slotMap[`${dayIdx}-${hourNum}`];
                        return (
                          <td key={`${dayIdx}-${hour}`} className="px-1 py-1">
                            <SlotCell
                              appointment={apt}
                              onClick={() => handleSlotClick(dayIdx, hour)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Availability Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Availability" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Day of Week</label>
            <select
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              value={addDay}
              onChange={(e) => setAddDay(Number(e.target.value))}
            >
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Start Time</label>
              <input
                type="time"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                value={addStart}
                onChange={(e) => setAddStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">End Time</label>
              <input
                type="time"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                value={addEnd}
                onChange={(e) => setAddEnd(e.target.value)}
              />
            </div>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={handleAddAvailability}
            disabled={manageScheduleMutation.isPending}
          >
            {manageScheduleMutation.isPending ? 'Saving...' : 'Save Availability'}
          </Button>
        </div>
      </Modal>

      {/* Quick Book Appointment Modal */}
      {bookSlot && (
        <QuickBookModal
          open
          onClose={() => setBookSlot(null)}
          doctorId={doctorId}
          date={bookSlot.date}
          time={bookSlot.time}
        />
      )}
    </div>
  );
}
