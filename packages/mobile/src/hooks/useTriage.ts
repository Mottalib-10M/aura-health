/**
 * useTriage Hook
 *
 * Manages the multi-step symptom triage flow: submitting symptom
 * descriptions, processing AI follow-up questions, collecting vital
 * signs, and retrieving triage results. Integrates with the backend
 * GraphQL API and provides offline queuing via the offline service.
 */

import { useCallback, useState } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { offlineService } from '../services/offline';
import { useAuthStore } from '../stores/authStore';
import type {
  TriageInput,
  TriageOutput,
  TriageSession,
  TriageSessionStatus,
} from '@aura/shared/types/triage';
import type { VitalSigns } from '@aura/shared/types/patient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { FollowUpQuestion, FollowUpAnswer } from '../types';

import type { FollowUpQuestion, FollowUpAnswer } from '../types';

export type TriageStep =
  | 'symptoms'
  | 'follow_up'
  | 'vitals'
  | 'analyzing'
  | 'results';

interface UseTriageReturn {
  /** Current step in the triage flow */
  currentStep: TriageStep;
  /** Move to a specific step */
  setStep: (step: TriageStep) => void;
  /** Active triage session ID */
  sessionId: string | null;
  /** Submit symptom description to begin triage */
  submitSymptoms: (description: string, language?: string) => Promise<boolean>;
  /** AI-generated follow-up questions */
  followUpQuestions: FollowUpQuestion[];
  /** Submit answers to follow-up questions */
  submitFollowUpAnswers: (answers: FollowUpAnswer[]) => Promise<boolean>;
  /** Submit vital signs data */
  submitVitals: (vitals: VitalSigns) => Promise<boolean>;
  /** Triage result (available after analysis) */
  result: TriageOutput | null;
  /** Full triage session data */
  session: TriageSession | null;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Whether the AI is actively analyzing */
  isAnalyzing: boolean;
  /** Error message */
  error: string | null;
  /** Reset triage state for a new session */
  reset: () => void;
  /** Save triage result to patient history */
  saveToHistory: () => Promise<boolean>;
  /** Share results with a doctor */
  shareWithDoctor: (doctorId: string) => Promise<boolean>;
  /** Triage history for current patient */
  history: TriageSession[];
  /** Fetch triage history */
  fetchHistory: () => void;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const TRIAGE_KEYS = {
  session: (id: string) => ['triage', 'session', id] as const,
  history: (patientId: string) => ['triage', 'history', patientId] as const,
  followUp: (sessionId: string) => ['triage', 'followUp', sessionId] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTriage(): UseTriageReturn {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const patientId = user?.id || '';

  const [currentStep, setCurrentStep] = useState<TriageStep>('symptoms');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [result, setResult] = useState<TriageOutput | null>(null);
  const [session, setSession] = useState<TriageSession | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch triage history
  const historyQuery = useQuery({
    queryKey: TRIAGE_KEYS.history(patientId),
    queryFn: () => apiClient.getTriageHistory(patientId),
    enabled: Boolean(patientId),
    staleTime: 5 * 60 * 1000,
  });

  // ---------------------------------------------------------------------------
  // Submit initial symptom description
  // ---------------------------------------------------------------------------

  const submitSymptomsMutation = useMutation({
    mutationFn: async ({
      description,
      language,
    }: {
      description: string;
      language?: string;
    }) => {
      return apiClient.submitSymptoms({
        patient_id: patientId,
        symptom_description: description,
        language: language || 'en',
      });
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setFollowUpQuestions(data.followUpQuestions || []);

      if (data.followUpQuestions && data.followUpQuestions.length > 0) {
        setCurrentStep('follow_up');
      } else {
        setCurrentStep('vitals');
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const submitSymptoms = useCallback(
    async (description: string, language?: string): Promise<boolean> => {
      setError(null);

      // Queue for offline sync if no connectivity
      try {
        await submitSymptomsMutation.mutateAsync({ description, language });
        return true;
      } catch {
        // Attempt offline queue
        try {
          await offlineService.queueMutation('submitSymptoms', {
            patient_id: patientId,
            symptom_description: description,
            language: language || 'en',
          });
          setError('You are offline. Your symptoms will be submitted when connectivity returns.');
          return false;
        } catch {
          return false;
        }
      }
    },
    [patientId, submitSymptomsMutation]
  );

  // ---------------------------------------------------------------------------
  // Submit follow-up answers
  // ---------------------------------------------------------------------------

  const submitFollowUpMutation = useMutation({
    mutationFn: async (answers: FollowUpAnswer[]) => {
      if (!sessionId) throw new Error('No active session.');
      return apiClient.submitFollowUpAnswers(sessionId, answers);
    },
    onSuccess: () => {
      setCurrentStep('vitals');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const submitFollowUpAnswers = useCallback(
    async (answers: FollowUpAnswer[]): Promise<boolean> => {
      setError(null);
      try {
        await submitFollowUpMutation.mutateAsync(answers);
        return true;
      } catch {
        return false;
      }
    },
    [submitFollowUpMutation]
  );

  // ---------------------------------------------------------------------------
  // Submit vital signs and trigger analysis
  // ---------------------------------------------------------------------------

  const submitVitalsMutation = useMutation({
    mutationFn: async (vitals: VitalSigns) => {
      if (!sessionId) throw new Error('No active session.');
      return apiClient.submitTriageVitals(sessionId, vitals);
    },
    onSuccess: async (data) => {
      setCurrentStep('analyzing');
      setIsAnalyzing(true);

      // Poll for results
      try {
        const triageResult = await pollForResults(data.sessionId || sessionId!);
        setResult(triageResult.output || null);
        setSession(triageResult);
        setCurrentStep('results');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Analysis failed. Please try again.'
        );
        setCurrentStep('vitals');
      } finally {
        setIsAnalyzing(false);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const submitVitals = useCallback(
    async (vitals: VitalSigns): Promise<boolean> => {
      setError(null);
      try {
        await submitVitalsMutation.mutateAsync(vitals);
        return true;
      } catch {
        return false;
      }
    },
    [submitVitalsMutation]
  );

  // ---------------------------------------------------------------------------
  // Poll for triage results
  // ---------------------------------------------------------------------------

  async function pollForResults(
    sid: string,
    maxAttempts = 30,
    intervalMs = 2000
  ): Promise<TriageSession> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const session = await apiClient.getTriageSession(sid);

      if (session.status === 'completed' || session.status === 'escalated') {
        return session;
      }

      if (session.status === 'cancelled' || session.status === 'expired') {
        throw new Error(`Triage session ${session.status}.`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Analysis is taking longer than expected. Please try again.');
  }

  // ---------------------------------------------------------------------------
  // Save & Share
  // ---------------------------------------------------------------------------

  const saveToHistory = useCallback(async (): Promise<boolean> => {
    if (!sessionId) return false;

    try {
      await apiClient.saveTriageToHistory(sessionId);
      queryClient.invalidateQueries({
        queryKey: TRIAGE_KEYS.history(patientId),
      });
      return true;
    } catch {
      setError('Failed to save results.');
      return false;
    }
  }, [sessionId, patientId, queryClient]);

  const shareWithDoctor = useCallback(
    async (doctorId: string): Promise<boolean> => {
      if (!sessionId) return false;

      try {
        await apiClient.shareTriageWithDoctor(sessionId, doctorId);
        return true;
      } catch {
        setError('Failed to share results.');
        return false;
      }
    },
    [sessionId]
  );

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  const reset = useCallback(() => {
    setCurrentStep('symptoms');
    setSessionId(null);
    setFollowUpQuestions([]);
    setResult(null);
    setSession(null);
    setIsAnalyzing(false);
    setError(null);
  }, []);

  const setStep = useCallback((step: TriageStep) => {
    setCurrentStep(step);
  }, []);

  const fetchHistory = useCallback(() => {
    historyQuery.refetch();
  }, [historyQuery]);

  return {
    currentStep,
    setStep,
    sessionId,
    submitSymptoms,
    followUpQuestions,
    submitFollowUpAnswers,
    submitVitals,
    result,
    session,
    isLoading:
      submitSymptomsMutation.isPending ||
      submitFollowUpMutation.isPending ||
      submitVitalsMutation.isPending,
    isAnalyzing,
    error,
    reset,
    saveToHistory,
    shareWithDoctor,
    history: historyQuery.data || [],
    fetchHistory,
  };
}
