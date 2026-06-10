import { useQuery } from '@tanstack/react-query';
import { gqlRequest } from '@/services/api';
import { GET_TRIAGE_HISTORY } from '@/services/graphql/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriageEventRow {
  id: string;
  patientId: string;
  symptoms: string[];
  symptomDescription: string;
  urgencyLevel: string;
  confidenceScore: number;
  recommendedSpecializations: string[];
  redFlags: string[];
  suggestedDiagnostics: string[];
  differentialDiagnoses: { code: string; name: string; probability: number }[];
  modelUsed: string;
  responseLatencyMs: number;
  followUpScheduled: boolean;
  createdAt: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTriageReview(patientId: string) {
  const triageQuery = useQuery({
    queryKey: ['triageHistory', patientId],
    queryFn: () =>
      gqlRequest<{ triageHistory: TriageEventRow[] }>(GET_TRIAGE_HISTORY, { patientId }),
    enabled: !!patientId,
  });

  return {
    triageEvents: triageQuery.data?.triageHistory ?? [],
    isLoading: triageQuery.isLoading,
    isError: triageQuery.isError,
    error: triageQuery.error,
    refetch: triageQuery.refetch,
  };
}
