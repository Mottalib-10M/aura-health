import { useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTriageStore } from '@/stores/triageStore';
import { useAuthStore } from '@/stores/authStore';
import { gqlRequest } from '@/services/api';
import {
  SUBMIT_TRIAGE_COMPLETE,
  GET_CLARIFYING_QUESTIONS,
} from '@/services/graphql/mutations';
import { GET_TRIAGE_SESSION, GET_TRIAGE_HISTORY } from '@/services/graphql/queries';
import type { TriageOutput } from '@aura/shared/types/triage';

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

  // Fetch clarifying questions based on symptom description
  const clarifyingMutation = useMutation({
    mutationFn: (symptomDescription: string) =>
      gqlRequest<ClarifyingQuestionsResponse>(GET_CLARIFYING_QUESTIONS, {
        symptomDescription,
        patientId: user?.id ?? '',
      }),
    onSuccess: ({ generateClarifyingQuestions }) => {
      store.setClarifyingQuestions(generateClarifyingQuestions.questions);
      store.setStep('clarifying');
    },
    onError: (error: Error) => {
      store.setError(error.message);
    },
  });

  // Submit complete triage for AI analysis
  const submitMutation = useMutation({
    mutationFn: () =>
      gqlRequest<TriageCompleteResponse>(SUBMIT_TRIAGE_COMPLETE, {
        input: {
          patientId: user?.id,
          symptomDescription: store.input.symptomDescription,
          symptomDurationHours: store.input.symptomDurationHours,
          severityScale: store.input.severityScale,
          clarifyingAnswers: store.input.clarifyingAnswers,
          vitalSigns: Object.keys(store.input.vitalSigns).length > 0
            ? store.input.vitalSigns
            : undefined,
          useWearableData: store.input.useWearableData,
        },
      }),
    onSuccess: ({ submitTriageComplete }) => {
      store.setResult(submitTriageComplete.output, submitTriageComplete.sessionId);
    },
    onError: (error: Error) => {
      store.setError(error.message);
      store.setStep('vitals'); // Go back so user can retry
    },
  });

  // Fetch a specific triage session
  const useTriageSession = (sessionId: string | null) =>
    useQuery({
      queryKey: ['triageSession', sessionId],
      queryFn: () =>
        gqlRequest<{ triageSession: TriageHistoryItem }>(GET_TRIAGE_SESSION, {
          sessionId,
        }),
      enabled: !!sessionId,
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
