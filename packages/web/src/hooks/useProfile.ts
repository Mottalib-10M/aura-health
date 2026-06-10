import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gqlRequest } from '@/services/api';
import { UPDATE_PATIENT_PROFILE } from '@/services/graphql/mutations';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpdateProfileInput {
  patientId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  language?: string;
  city?: string;
}

interface PatientResult {
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
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProfile() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);

  const updateMutation = useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      gqlRequest<{ updatePatientProfile: PatientResult }>(UPDATE_PATIENT_PROFILE, { input }),
    onSuccess: ({ updatePatientProfile: result }) => {
      // Update local auth store with new name/language
      updateUser({
        firstName: result.firstName,
        lastName: result.lastName,
        preferredLanguage: result.language,
      });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['patientMedicalRecords'] });
    },
  });

  return {
    updateProfile: updateMutation.mutate,
    updateProfileAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isSuccess: updateMutation.isSuccess,
    error: updateMutation.error,
    reset: updateMutation.reset,
  };
}
