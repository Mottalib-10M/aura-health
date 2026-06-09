import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, type UserRole } from '@/stores/authStore';
import { gqlRequest } from '@/services/api';
import { LOGIN, REGISTER, REFRESH_TOKEN, LOGOUT } from '@/services/graphql/mutations';
import { GET_CURRENT_USER } from '@/services/graphql/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoginVariables {
  email: string;
  password: string;
}

interface RegisterVariables {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  preferredLanguage: string;
  institutionId?: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    avatarUrl?: string;
    preferredLanguage: string;
    institutionId?: string;
  };
  token: string;
  refreshToken: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Role-based route prefixes
// ---------------------------------------------------------------------------

const ROLE_ROUTES: Record<UserRole, string> = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  hospital_admin: '/hospital/dashboard',
  analyst: '/analyst/dashboard',
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const store = useAuthStore();

  // Fetch current user from server to validate token
  const { data: currentUser, isLoading: isValidating } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => gqlRequest<{ me: AuthResponse['user'] }>(GET_CURRENT_USER),
    enabled: store.isAuthenticated && !!store.token,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (variables: LoginVariables) =>
      gqlRequest<{ login: AuthResponse }>(LOGIN, { ...variables }),
    onSuccess: ({ login }) => {
      store.login(login.user, login.token, login.refreshToken);
      navigate(ROLE_ROUTES[login.user.role] ?? '/');
    },
    onError: (error: Error) => {
      store.setError(error.message);
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (variables: RegisterVariables) =>
      gqlRequest<{ register: AuthResponse }>(REGISTER, { input: variables }),
    onSuccess: ({ register }) => {
      store.login(register.user, register.token, register.refreshToken);
      navigate(ROLE_ROUTES[register.user.role] ?? '/');
    },
    onError: (error: Error) => {
      store.setError(error.message);
    },
  });

  // Token refresh mutation
  const refreshMutation = useMutation({
    mutationFn: () => {
      if (!store.refreshToken) throw new Error('No refresh token available');
      return gqlRequest<{ refreshToken: { token: string; refreshToken: string } }>(
        REFRESH_TOKEN,
        { refreshToken: store.refreshToken },
      );
    },
    onSuccess: ({ refreshToken }) => {
      store.setTokens(refreshToken.token, refreshToken.refreshToken);
    },
    onError: () => {
      store.logout();
      navigate('/login');
    },
  });

  // Logout
  const logout = useCallback(async () => {
    try {
      await gqlRequest(LOGOUT);
    } catch {
      // Proceed with local logout even if server call fails
    } finally {
      store.logout();
      queryClient.clear();
      navigate('/login');
    }
  }, [store, queryClient, navigate]);

  // Login helper
  const login = useCallback(
    (email: string, password: string) => {
      // Dev-mode test user bypass (no backend required)
      if (import.meta.env.DEV && password === 'sherz') {
        const devUsers: Record<string, typeof store.user & {}> = {
          'sherz@uzavita.com': {
            id: 'dev-sherz-001',
            email: 'sherz@uzavita.com',
            firstName: 'Sherz',
            lastName: 'Uzavita',
            role: 'doctor',
            preferredLanguage: 'uz',
          },
          'sherz2@uzavita.com': {
            id: 'dev-sherz-002',
            email: 'sherz2@uzavita.com',
            firstName: 'Sherz',
            lastName: 'Patient',
            role: 'patient',
            preferredLanguage: 'uz',
          },
        };
        const devUser = devUsers[email];
        if (devUser) {
          store.login(devUser, `dev-token-${devUser.id}`, `dev-refresh-${devUser.id}`);
          navigate(ROLE_ROUTES[devUser.role]);
          return;
        }
      }

      store.setLoading(true);
      store.setError(null);
      loginMutation.mutate({ email, password });
    },
    [store, loginMutation, navigate],
  );

  // Register helper
  const register = useCallback(
    (data: RegisterVariables) => {
      store.setLoading(true);
      store.setError(null);
      registerMutation.mutate(data);
    },
    [store, registerMutation],
  );

  // Role check helpers
  const hasRole = useCallback(
    (role: UserRole) => store.user?.role === role,
    [store.user],
  );

  const hasAnyRole = useCallback(
    (roles: UserRole[]) => store.user ? roles.includes(store.user.role) : false,
    [store.user],
  );

  return {
    user: store.user ?? currentUser?.me ?? null,
    token: store.token,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading || loginMutation.isPending || registerMutation.isPending,
    isValidating,
    error: store.error,
    login,
    register,
    logout,
    refreshToken: refreshMutation.mutate,
    hasRole,
    hasAnyRole,
    getRoleRoute: (role: UserRole) => ROLE_ROUTES[role],
  };
}
