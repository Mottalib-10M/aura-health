import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gqlRequest } from '@/services/api';
import { GET_DOCTOR_SCHEDULE, GET_DOCTOR_APPOINTMENTS } from '@/services/graphql/queries';
import { MANAGE_DOCTOR_SCHEDULE } from '@/services/graphql/mutations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface AppointmentRow {
  id: string;
  patientId: string;
  doctorId: string;
  institutionId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    bloodType: string | null;
    region: string;
    city: string;
  };
}

interface ScheduleInput {
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSchedule(doctorId: string, date?: string) {
  const queryClient = useQueryClient();

  const scheduleQuery = useQuery({
    queryKey: ['doctorSchedule', doctorId, date],
    queryFn: () =>
      gqlRequest<{ doctorSchedule: TimeSlot[] }>(GET_DOCTOR_SCHEDULE, {
        doctorId,
        date: date!,
      }),
    enabled: !!doctorId && !!date,
  });

  const appointmentsQuery = useQuery({
    queryKey: ['doctorAppointments', doctorId, date],
    queryFn: () =>
      gqlRequest<{ doctorAppointments: AppointmentRow[] }>(GET_DOCTOR_APPOINTMENTS, {
        doctorId,
        date,
      }),
    enabled: !!doctorId,
  });

  const manageScheduleMutation = useMutation({
    mutationFn: (input: ScheduleInput) =>
      gqlRequest<{ manageDoctorSchedule: boolean }>(MANAGE_DOCTOR_SCHEDULE, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorSchedule', doctorId] });
    },
  });

  return {
    slots: scheduleQuery.data?.doctorSchedule ?? [],
    appointments: appointmentsQuery.data?.doctorAppointments ?? [],
    isLoading: scheduleQuery.isLoading || appointmentsQuery.isLoading,
    isError: scheduleQuery.isError || appointmentsQuery.isError,
    error: scheduleQuery.error || appointmentsQuery.error,
    refetch: () => {
      scheduleQuery.refetch();
      appointmentsQuery.refetch();
    },
    manageSchedule: manageScheduleMutation.mutate,
    isManaging: manageScheduleMutation.isPending,
  };
}
