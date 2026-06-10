import { useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTriageStore } from '@/stores/triageStore';
import { useAuthStore } from '@/stores/authStore';
import { gqlRequest } from '@/services/api';
import { SUBMIT_SYMPTOM_TRIAGE } from '@/services/graphql/mutations';
import { GET_TRIAGE_HISTORY } from '@/services/graphql/queries';
import type { TriageOutput } from '@uzavita/shared/types/triage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClarifyingQuestionsResponse {
  generateClarifyingQuestions: {
    questions: Array<{
      id: string;
      question: string;
      type: 'yes_no' | 'scale' | 'text' | 'multi_select';
      options?: string[];
    }>;
  };
}

interface TriageCompleteResponse {
  submitTriageComplete: {
    sessionId: string;
    output: TriageOutput;
    modelVersion: string;
    inferenceLatencyMs: number;
  };
}

interface TriageHistoryItem {
  id: string;
  urgencyLevel: string;
  status: string;
  output?: {
    urgencyLevel: string;
    recommendedSpecializations: Array<{
      specialty: string;
      confidenceScore: number;
    }>;
  };
  createdAt: string;
}

interface TriageHistoryResponse {
  triageHistory: {
    items: TriageHistoryItem[];
    totalCount: number;
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTriage() {
  const store = useTriageStore();
  const user = useAuthStore((s) => s.user);

  // Clarifying questions are generated client-side (no backend endpoint)
  // Move to clarifying step directly so the UI flow is preserved
  const clarifyingMutation = useMutation({
    mutationFn: async (symptomDescription: string) => {
      // No backend endpoint — skip to next step
      return { generateClarifyingQuestions: { questions: [] } } as ClarifyingQuestionsResponse;
    },
    onSuccess: ({ generateClarifyingQuestions }) => {
      store.setClarifyingQuestions(generateClarifyingQuestions.questions);
      store.setStep('clarifying');
    },
    onError: (error: Error) => {
      store.setError(error.message);
    },
  });

  // Submit triage for AI analysis via submitSymptomTriage
  const submitMutation = useMutation({
    mutationFn: () =>
      gqlRequest<{ submitSymptomTriage: TriageOutput }>(SUBMIT_SYMPTOM_TRIAGE, {
        input: {
          patientId: user?.id,
          symptoms: store.input.symptomDescription.split(',').map((s: string) => s.trim()).filter(Boolean),
          symptomDescription: store.input.symptomDescription,
          severity: store.input.severityScale,
          vitalSigns: Object.keys(store.input.vitalSigns).length > 0
            ? store.input.vitalSigns
            : undefined,
        },
      }),
    onSuccess: ({ submitSymptomTriage }) => {
      store.setResult(submitSymptomTriage, (submitSymptomTriage as any).triageEventId ?? '');
    },
    onError: (error: Error) => {
      store.setError(error.message);
      store.setStep('vitals'); // Go back so user can retry
    },
  });

  // Fetch a specific triage session (uses triageHistory filtered client-side)
  const useTriageSession = (sessionId: string | null) =>
    useQuery({
      queryKey: ['triageSession', sessionId],
      queryFn: async () => {
        if (!user?.id) throw new Error('Not authenticated');
        const data = await gqlRequest<{ triageHistory: TriageHistoryItem[] }>(GET_TRIAGE_HISTORY, {
          patientId: user.id,
        });
        const session = data.triageHistory.find((t) => t.id === sessionId);
        if (!session) throw new Error('Session not found');
        return { triageSession: session };
      },
      enabled: !!sessionId && !!user?.id,
    });

  // Fetch triage history for the current patient
  const useTriageHistory = (limit = 10, offset = 0) =>
    useQuery({
      queryKey: ['triageHistory', user?.id, limit, offset],
      queryFn: () =>
        gqlRequest<TriageHistoryResponse>(GET_TRIAGE_HISTORY, {
          patientId: user?.id ?? '',
          limit,
          offset,
        }),
      enabled: !!user?.id,
    });

  // Step 1: Submit symptoms and get clarifying questions
  const submitSymptoms = useCallback(() => {
    if (!store.input.symptomDescription.trim()) {
      store.setError('Please describe your symptoms');
      return;
    }
    store.setError(null);
    clarifyingMutation.mutate(store.input.symptomDescription);
  }, [store, clarifyingMutation]);

  // Step 3 -> 4: Submit full triage for analysis
  const submitForAnalysis = useCallback(() => {
    store.setStep('analyzing');
    store.setProcessing(true);

    // Add a small intentional delay for the analysis animation
    setTimeout(() => {
      submitMutation.mutate();
    }, 2000);
  }, [store, submitMutation]);

  // Reset and start over
  const resetTriage = useCallback(() => {
    store.resetTriage();
  }, [store]);

  return {
    // State
    currentStep: store.currentStep,
    input: store.input,
    clarifyingQuestions: store.clarifyingQuestions,
    result: store.result,
    sessionId: store.sessionId,
    isProcessing: store.isProcessing || clarifyingMutation.isPending || submitMutation.isPending,
    error: store.error,
    progress: store.getProgress(),

    // Actions
    setSymptomDescription: store.setSymptomDescription,
    setSymptomDuration: store.setSymptomDuration,
    setSeverityScale: store.setSeverityScale,
    setClarifyingAnswer: store.setClarifyingAnswer,
    setVitalSigns: store.setVitalSigns,
    setUseWearableData: store.setUseWearableData,
    setStep: store.setStep,
    nextStep: store.nextStep,
    prevStep: store.prevStep,
    submitSymptoms,
    submitForAnalysis,
    resetTriage,

    // Query hooks
    useTriageSession,
    useTriageHistory,
  };
}
