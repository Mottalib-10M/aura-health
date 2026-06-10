import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gqlRequest } from '@/services/api';
import { GET_PATIENT_TELEMETRY } from '@/services/graphql/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TelemetryReading {
  metricType: string;
  value: number;
  recordedAt: string;
}

interface TelemetryData {
  patientId: string;
  days: number;
  heartRateAvg: number | null;
  spO2Avg: number | null;
  readings: TelemetryReading[];
}

interface TelemetryOptions {
  patientId: string;
  days?: number;
  realtime?: boolean;
  pollInterval?: number;
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByMetric(readings: TelemetryReading[]) {
  const grouped: Record<string, { timestamp: string; value: number }[]> = {};
  for (const r of readings) {
    if (!grouped[r.metricType]) grouped[r.metricType] = [];
    grouped[r.metricType].push({ timestamp: r.recordedAt, value: r.value });
  }
  // Sort each metric by time ascending
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTelemetry({
  patientId,
  days = 7,
  realtime = false,
  pollInterval,
  enabled = true,
}: TelemetryOptions) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const telemetryQuery = useQuery({
    queryKey: ['patientTelemetry', patientId, days],
    queryFn: () =>
      gqlRequest<{ patientTelemetry: TelemetryData }>(GET_PATIENT_TELEMETRY, {
        patientId,
        days,
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

      ws.onopen = () => setIsConnected(true);

      ws.onmessage = (event: MessageEvent) => {
        try {
          const update = JSON.parse(event.data as string) as TelemetryReading;
          queryClient.setQueryData<{ patientTelemetry: TelemetryData }>(
            ['patientTelemetry', patientId, days],
            (old) => {
              if (!old) return old;
              return {
                patientTelemetry: {
                  ...old.patientTelemetry,
                  readings: [...old.patientTelemetry.readings, update].slice(-1000),
                },
              };
            },
          );
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => setIsConnected(false);

      return () => {
        ws.close();
        wsRef.current = null;
        setIsConnected(false);
      };
    } catch {
      setIsConnected(false);
    }

    return undefined;
  }, [realtime, patientId, enabled, queryClient, days]);

  const data = telemetryQuery.data?.patientTelemetry;
  const readings = data?.readings ?? [];
  const vitals = groupByMetric(readings);

  const getLatestVital = useCallback(
    (metric: string): { timestamp: string; value: number } | null => {
      const series = vitals[metric];
      if (!series || series.length === 0) return null;
      return series[series.length - 1];
    },
    [vitals],
  );

  const getTrend = useCallback(
    (metric: string): { direction: 'up' | 'down' | 'stable'; change: number } => {
      const series = vitals[metric];
      if (!series || series.length < 2) return { direction: 'stable', change: 0 };

      const recent = series.slice(-10);
      const mid = Math.floor(recent.length / 2);
      const firstHalf = recent.slice(0, mid);
      const secondHalf = recent.slice(mid);

      const avgFirst = firstHalf.reduce((s, d) => s + d.value, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, d) => s + d.value, 0) / secondHalf.length;

      const change = avgFirst !== 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;
      const threshold = 2;

      return {
        direction: change > threshold ? 'up' : change < -threshold ? 'down' : 'stable',
        change: Math.round(change * 10) / 10,
      };
    },
    [vitals],
  );

  return {
    data,
    vitals,
    heartRateAvg: data?.heartRateAvg ?? null,
    spO2Avg: data?.spO2Avg ?? null,
    isLoading: telemetryQuery.isLoading,
    isError: telemetryQuery.isError,
    error: telemetryQuery.error,
    isConnected,
    refetch: telemetryQuery.refetch,
    getLatestVital,
    getTrend,
  };
}
