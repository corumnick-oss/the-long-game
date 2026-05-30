import { QueryClient } from '@tanstack/react-query';
import type { User } from 'firebase/auth';
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

// When `user` is provided (from React state), use it directly — avoids any
// timing gap between onAuthStateChanged firing and auth.currentUser updating.
// Falls back to auth.currentUser for mutations that run after auth is established.
export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
  user?: User | null,
): Promise<T> {
  const token = user
    ? await user.getIdToken()
    : await auth.currentUser?.getIdToken();

  if (__DEV__) {
    console.log('[apiFetch]', path, '| user:', user?.uid ?? 'null', '| hasToken:', !!token);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
