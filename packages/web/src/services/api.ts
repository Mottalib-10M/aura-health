import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GRAPHQL_ENDPOINT =
  import.meta.env.VITE_GRAPHQL_ENDPOINT ??
  `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000'}/graphql`;

// ---------------------------------------------------------------------------
// GraphQL Client — plain fetch, no library overhead
// ---------------------------------------------------------------------------

/**
 * Execute a typed GraphQL query or mutation using native fetch.
 */
export async function gqlRequest<TData, TVariables extends Record<string, unknown> = Record<string, unknown>>(
  document: string,
  variables?: TVariables,
): Promise<TData> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: document,
        variables: variables ?? undefined,
      }),
    });
  } catch (networkError) {
    throw new Error('Network error — unable to reach the server');
  }

  // Handle non-OK HTTP responses
  if (!response.ok) {
    // Token expired / unauthorized → logout
    if (response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    const text = await response.text().catch(() => '');
    throw new Error(text || `Server error (${response.status})`);
  }

  const json = await response.json();

  // Handle GraphQL-level errors
  if (json.errors?.length) {
    const messages = json.errors.map((e: { message: string }) => e.message).join(', ');

    // Check for auth errors in GraphQL responses
    if (messages.includes('UNAUTHENTICATED') || messages.includes('401')) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }

    throw new Error(messages);
  }

  return json.data as TData;
}
