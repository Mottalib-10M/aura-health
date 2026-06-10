import { useQuery } from '@tanstack/react-query';
import { gqlRequest } from '@/services/api';
import { GET_DOCTOR_PATIENTS } from '@/services/graphql/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PatientRow {
  id: string;
  auraId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string | null;
  region: string;
  city: string;
  language: string;
  createdAt: string;
  telemetrySummary: {
    latestHeartRate: number | null;
    latestSpO2: number | null;
    averageHeartRate: number | null;
    averageSpO2: number | null;
    lastUpdated: string | null;
  } | null;
  appointments: {
    id: string;
    scheduledAt: string;
    status: string;
    reason: string | null;
  }[];
  prescriptions: {
    id: string;
    diagnosisCodes: string[];
    medications: { drugName: string; dosage: string; frequency: string }[];
    createdAt: string;
  }[];
  triageHistory: {
    id: string;
    urgencyLevel: string;
    confidenceScore: number;
    symptoms: string[];
    createdAt: string;
  }[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePatients(doctorId: string) {
  const patientsQuery = useQuery({
    queryKey: ['doctorPatients', doctorId],
    queryFn: () =>
      gqlRequest<{ doctorPatients: PatientRow[] }>(GET_DOCTOR_PATIENTS, { doctorId }),
    enabled: !!doctorId,
  });

  return {
    patients: patientsQuery.data?.doctorPatients ?? [],
    isLoading: patientsQuery.isLoading,
    isError: patientsQuery.isError,
    error: patientsQuery.error,
    refetch: patientsQuery.refetch,
  };
}
