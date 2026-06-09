import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gqlRequest } from '@/services/api';
import { GET_PATIENT_VITALS } from '@/services/graphql/queries';
import type { TimeSeriesDataPoint, BiometricMetrics } from '@uzavita/shared/types/telemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VitalsQueryResponse {
  patientVitals: {
    heartRate: TimeSeriesDataPoint[];
    spO2: TimeSeriesDataPoint[];
    hrvMs: TimeSeriesDataPoint[];
    steps: TimeSeriesDataPoint[];
    sleepHours: TimeSeriesDataPoint[];
    bloodGlucose?: TimeSeriesDataPoint[];
  };
}

interface TelemetryOptions {
  /** Patient ID to fetch vitals for */
  patientId: string;
  /** ISO date string for the start of the window */
  from?: string;
  /** ISO date string for the end of the window */
  to?: string;
  /** Whether to enable real-time WebSocket updates */
  realtime?: boolean;
  /** Polling interval in milliseconds (fallback when WS unavailable) */
  pollInterval?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

interface RealtimeVitalUpdate {
  patientId: string;
  metric: keyof BiometricMetrics;
  dataPoint: TimeSeriesDataPoint;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTelemetry({
  patientId,
  from,
  to,
  realtime = false,
  pollInterval,
  enabled = true,
}: TelemetryOptions) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Main vitals query
  const vitalsQuery = useQuery({
    queryKey: ['patientVitals', patientId, from, to],
    queryFn: () =>
      gqlRequest<VitalsQueryResponse>(GET_PATIENT_VITALS, {
        patientId,
        from,
        to,
      }),
    enabled: enabled && !!patientId,
    refetchInterval: realtime ? undefined : pollInterval,
    staleTime: realtime ? Infinity : 1000 * 30,
  });

  // WebSocket real-time updates
  useEffect(() => {
    if (!realtime || !patientId || !enabled) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/telemetry/${patientId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const update: RealtimeVitalUpdate = JSON.parse(event.data as string);

          // Optimistically update the query cache with new data points
          queryClient.setQueryData<VitalsQueryResponse>(
            ['patientVitals', patientId, from, to],
            (old) => {
              if (!old) return old;

              const metricKey = update.metric as keyof VitalsQueryResponse['patientVitals'];
              const currentData = old.patientVitals[metricKey];
              if (!Array.isArray(currentData)) return old;

              return {
                patientVitals: {
                  ...old.patientVitals,
                  [metricKey]: [...currentData, update.dataPoint].slice(-200),
                },
              };
            },
          );
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      return () => {
        ws.close();
        wsRef.current = null;
        setIsConnected(false);
      };
    } catch {
      setIsConnected(false);
    }

    return undefined;
  }, [realtime, patientId, enabled, queryClient, from, to]);

  // Compute derived statistics
  const getLatestVital = useCallback(
    (metric: keyof VitalsQueryResponse['patientVitals']): TimeSeriesDataPoint | null => {
      const data = vitalsQuery.data?.patientVitals[metric];
      if (!Array.isArray(data) || data.length === 0) return null;
      return data[data.length - 1];
    },
    [vitalsQuery.data],
  );

  const getTrend = useCallback(
    (metric: keyof VitalsQueryResponse['patientVitals']): { direction: 'up' | 'down' | 'stable'; change: number } => {
      const data = vitalsQuery.data?.patientVitals[metric];
      if (!Array.isArray(data) || data.length < 2) {
        return { direction: 'stable', change: 0 };
      }

      const recent = data.slice(-10);
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));

      const avgFirst = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;

      const change = avgFirst !== 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;
      const threshold = 2; // 2% threshold for "stable"

      return {
        direction: change > threshold ? 'up' : change < -threshold ? 'down' : 'stable',
        change: Math.round(change * 10) / 10,
      };
    },
    [vitalsQuery.data],
  );

  return {
    vitals: vitalsQuery.data?.patientVitals ?? null,
    isLoading: vitalsQuery.isLoading,
    isError: vitalsQuery.isError,
    error: vitalsQuery.error,
    isConnected,
    refetch: vitalsQuery.refetch,
    getLatestVital,
    getTrend,
  };
}
