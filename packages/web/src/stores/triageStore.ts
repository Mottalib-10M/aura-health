import { create } from 'zustand';
import type { TriageOutput, SeverityScale } from '@aura/shared/types/triage';
import type { VitalSigns } from '@aura/shared/types/patient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TriageStep =
  | 'symptoms'
  | 'clarifying'
  | 'vitals'
  | 'analyzing'
  | 'results';

export interface ClarifyingQuestion {
  id: string;
  question: string;
  type: 'yes_no' | 'scale' | 'text' | 'multi_select';
  options?: string[];
}

interface TriageInputState {
  symptomDescription: string;
  symptomDurationHours: number;
  severityScale: SeverityScale;
  clarifyingAnswers: Record<string, string>;
  vitalSigns: Partial<VitalSigns>;
  useWearableData: boolean;
}

interface TriageFlowState {
  currentStep: TriageStep;
  input: TriageInputState;
  clarifyingQuestions: ClarifyingQuestion[];
  result: TriageOutput | null;
  sessionId: string | null;
  isProcessing: boolean;
  error: string | null;
}

interface TriageActions {
  setStep: (step: TriageStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setSymptomDescription: (description: string) => void;
  setSymptomDuration: (hours: number) => void;
  setSeverityScale: (scale: SeverityScale) => void;
  setClarifyingQuestions: (questions: ClarifyingQuestion[]) => void;
  setClarifyingAnswer: (questionId: string, answer: string) => void;
  setVitalSigns: (vitals: Partial<VitalSigns>) => void;
  setUseWearableData: (use: boolean) => void;
  setResult: (result: TriageOutput, sessionId: string) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  resetTriage: () => void;
  getProgress: () => number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_ORDER: TriageStep[] = [
  'symptoms',
  'clarifying',
  'vitals',
  'analyzing',
  'results',
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialInput: TriageInputState = {
  symptomDescription: '',
  symptomDurationHours: 0,
  severityScale: 3,
  clarifyingAnswers: {},
  vitalSigns: {},
  useWearableData: false,
};

const initialState: TriageFlowState = {
  currentStep: 'symptoms',
  input: { ...initialInput },
  clarifyingQuestions: [],
  result: null,
  sessionId: null,
  isProcessing: false,
  error: null,
};

export const useTriageStore = create<TriageFlowState & TriageActions>()(
  (set, get) => ({
    ...initialState,

    setStep: (currentStep) => set({ currentStep }),

    nextStep: () => {
      const { currentStep } = get();
      const idx = STEP_ORDER.indexOf(currentStep);
      if (idx < STEP_ORDER.length - 1) {
        set({ currentStep: STEP_ORDER[idx + 1] });
      }
    },

    prevStep: () => {
      const { currentStep } = get();
      const idx = STEP_ORDER.indexOf(currentStep);
      if (idx > 0) {
        set({ currentStep: STEP_ORDER[idx - 1] });
      }
    },

    setSymptomDescription: (symptomDescription) =>
      set((state) => ({
        input: { ...state.input, symptomDescription },
      })),

    setSymptomDuration: (symptomDurationHours) =>
      set((state) => ({
        input: { ...state.input, symptomDurationHours },
      })),

    setSeverityScale: (severityScale) =>
      set((state) => ({
        input: { ...state.input, severityScale },
      })),

    setClarifyingQuestions: (clarifyingQuestions) =>
      set({ clarifyingQuestions }),

    setClarifyingAnswer: (questionId, answer) =>
      set((state) => ({
        input: {
          ...state.input,
          clarifyingAnswers: {
            ...state.input.clarifyingAnswers,
            [questionId]: answer,
          },
        },
      })),

    setVitalSigns: (vitalSigns) =>
      set((state) => ({
        input: {
          ...state.input,
          vitalSigns: { ...state.input.vitalSigns, ...vitalSigns },
        },
      })),

    setUseWearableData: (useWearableData) =>
      set((state) => ({
        input: { ...state.input, useWearableData },
      })),

    setResult: (result, sessionId) =>
      set({
        result,
        sessionId,
        currentStep: 'results',
        isProcessing: false,
      }),

    setProcessing: (isProcessing) => set({ isProcessing }),

    setError: (error) => set({ error, isProcessing: false }),

    resetTriage: () => set({ ...initialState, input: { ...initialInput } }),

    getProgress: () => {
      const { currentStep } = get();
      const idx = STEP_ORDER.indexOf(currentStep);
      return ((idx + 1) / STEP_ORDER.length) * 100;
    },
  }),
);
