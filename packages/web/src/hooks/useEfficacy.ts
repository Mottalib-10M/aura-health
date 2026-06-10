import { useQuery } from '@tanstack/react-query';
import { gqlRequest } from '@/services/api';
import { GET_EFFICACY_METRICS } from '@/services/graphql/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EfficacyMetricRow {
  id: string;
  drugName: string;
  dosage: string;
  diagnosisCode: string;
  cohortSize: number;
  outcomeMetrics: {
    remissionRate: number;
    averageDaysToImprovement: number;
    sideEffectRate: number;
    readmissionRate: number;
    patientSatisfaction: number | null;
  };
  comparativeEffectiveness: number | null;
  region: string | null;
  timeframeMonths: number;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEfficacy(drugName?: string, diagnosisCode?: string) {
  const metricsQuery = useQuery({
    queryKey: ['efficacyMetrics', drugName, diagnosisCode],
    queryFn: () =>
      gqlRequest<{ efficacyMetrics: EfficacyMetricRow[] }>(GET_EFFICACY_METRICS, {
        ...(drugName ? { drugName } : {}),
        ...(diagnosisCode ? { diagnosisCode } : {}),
      }),
  });

  return {
    metrics: metricsQuery.data?.efficacyMetrics ?? [],
    isLoading: metricsQuery.isLoading,
    isError: metricsQuery.isError,
    error: metricsQuery.error,
    refetch: metricsQuery.refetch,
  };
}
