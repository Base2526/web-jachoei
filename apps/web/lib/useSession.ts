// apps/web/lib/useSession.ts
'use client'
import useSWR from 'swr';

const fetcher = (url: string) =>fetch(url, { credentials: 'include', cache: 'no-store' }).then(r => r.json());
export function useSession() {
  const url = '/api/auth/me';
  const { data, error, isLoading, mutate } = useSWR(url, fetcher);
  return {
    user: data?.user ?? null,
    admin: data?.admin ?? null,
    isAuthenticated: Boolean(data?.isAuthenticated),
    loading: isLoading && !error,
    refreshSession: () => mutate(),
    error,
  };
}
