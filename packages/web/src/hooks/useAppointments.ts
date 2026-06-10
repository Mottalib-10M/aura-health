import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gqlRequest } from '@/services/api';
import { GET_PATIENT_APPOINTMENTS } from '@/services/graphql/queries';
import { CREATE_APPOINTMENT, CANCEL_APPOINTMENT } from '@/services/graphql/mutations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppointmentRow {
  id: string;
  patientId: string;
  doctorId: string;
  institutionId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  checkInCode: string | null;
  estimatedWait: number | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
    specialty: string;
    institutionId: string | null;
  };
}

interface CreateAppointmentInput {
  patientId: string;
  doctorId?: string;
  institutionId?: string;
  specialty: string;
  preferredDate?: string;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  urgencyLevel?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAppointments(patientId: string, status?: string) {
  const queryClient = useQueryClient();

  const appointmentsQuery = useQuery({
    queryKey: ['patientAppointments', patientId, status],
    queryFn: () =>
      gqlRequest<{ patientAppointments: AppointmentRow[] }>(GET_PATIENT_APPOINTMENTS, {
        patientId,
        ...(status ? { status } : {}),
      }),
    enabled: !!patientId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateAppointmentInput) =>
      gqlRequest<{ createAppointment: { appointment: AppointmentRow } }>(CREATE_APPOINTMENT, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientAppointments', patientId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ appointmentId, reason }: { appointmentId: string; reason?: string }) =>
      gqlRequest<{ cancelAppointment: AppointmentRow }>(CANCEL_APPOINTMENT, { appointmentId, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientAppointments', patientId] });
    },
  });

  return {
    appointments: appointmentsQuery.data?.patientAppointments ?? [],
    isLoading: appointmentsQuery.isLoading,
    isError: appointmentsQuery.isError,
    error: appointmentsQuery.error,
    refetch: appointmentsQuery.refetch,
    createAppointment: createMutation.mutate,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    cancelAppointment: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,
    cancelError: cancelMutation.error,
  };
}
