import { useQuery } from '@tanstack/react-query';
import { gqlRequest } from '@/services/api';
import { GET_PATIENT } from '@/services/graphql/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MedicalRecord {
  id: string;
  auraId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string | null;
  region: string;
  city: string;
  prescriptions: {
    id: string;
    doctorId: string;
    diagnosisCodes: string[];
    medications: {
      drugName: string;
      dosage: string;
      frequency: string;
      durationDays: number;
      route: string;
      instructions: string | null;
    }[];
    outcomeAssessment: string | null;
    efficacyScore: number | null;
    sideEffectsReported: string[];
    followUpDate: string | null;
    createdAt: string;
    doctor: {
      id: string;
      firstName: string;
      lastName: string;
      specialty: string;
    };
  }[];
  triageHistory: {
    id: string;
    urgencyLevel: string;
    confidenceScore: number;
    symptoms: string[];
    symptomDescription: string;
    recommendedSpecializations: string[];
    createdAt: string;
  }[];
  appointments: {
    id: string;
    doctorId: string;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
    reason: string | null;
    doctor: {
      id: string;
      firstName: string;
      lastName: string;
      specialty: string;
    };
  }[];
  telemetrySummary: {
    latestHeartRate: number | null;
    latestSpO2: number | null;
    averageHeartRate: number | null;
    averageSpO2: number | null;
    hrvMean: number | null;
    hrvSdnn: number | null;
    lastUpdated: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMedicalRecords(patientId: string) {
  const recordsQuery = useQuery({
    queryKey: ['patientMedicalRecords', patientId],
    queryFn: () =>
      gqlRequest<{ patient: MedicalRecord }>(GET_PATIENT, { id: patientId }),
    enabled: !!patientId,
  });

  return {
    patient: recordsQuery.data?.patient ?? null,
    isLoading: recordsQuery.isLoading,
    isError: recordsQuery.isError,
    error: recordsQuery.error,
    refetch: recordsQuery.refetch,
  };
}
