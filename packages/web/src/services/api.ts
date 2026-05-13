import { GraphQLClient, type RequestMiddleware, type ResponseMiddleware } from 'graphql-request';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT ?? '/graphql';

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Injects the Authorization header with the current bearer token.
 */
const requestMiddleware: RequestMiddleware = async (request) => {
  const token = useAuthStore.getState().token;

  return {
    ...request,
    headers: {
      ...request.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};

/**
 * Handles response-level errors such as expired tokens.
 */
const responseMiddleware: ResponseMiddleware = (response) => {
  if (response instanceof Error) {
    const message = response.message;

    // Handle token expiry by logging out
    if (message.includes('UNAUTHENTICATED') || message.includes('401')) {
      const { logout } = useAuthStore.getState();
      logout();
      window.location.href = '/login';
    }
  }
};

// ---------------------------------------------------------------------------
// GraphQL Client
// ---------------------------------------------------------------------------

export const graphqlClient = new GraphQLClient(GRAPHQL_ENDPOINT, {
  requestMiddleware,
  responseMiddleware,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Helper: Execute a typed GraphQL request
// ---------------------------------------------------------------------------

/**
 * Execute a typed GraphQL query or mutation.
 * Wraps graphql-request's `request` with error normalization.
 */
export async function gqlRequest<TData, TVariables extends Record<string, unknown> = Record<string, unknown>>(
  document: string,
  variables?: TVariables,
): Promise<TData> {
  try {
    return await graphqlClient.request<TData>(document, variables as Record<string, unknown>);
  } catch (error: unknown) {
    // Normalize GraphQL errors into a readable format
    if (error && typeof error === 'object' && 'response' in error) {
      const gqlError = error as { response: { errors?: Array<{ message: string }> } };
      const messages = gqlError.response.errors?.map((e) => e.message).join(', ');
      throw new Error(messages ?? 'An unexpected GraphQL error occurred');
    }
    throw error;
  }
}
