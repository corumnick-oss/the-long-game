import { QueryClient } from '@tanstack/react-query';
import { auth } from './firebase';

export const API_BASE = 'https://thelonggame-production.up.railway.app';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  // Wait for Firebase to finish restoring the persisted session before reading currentUser.
  // Without this, currentUser is null on app open even for logged-in users, so no Bearer
  // token is sent and the backend can't return user-specific data (myPick, etc.).
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
