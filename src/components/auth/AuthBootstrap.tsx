'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

export function AuthBootstrap() {
  const setUser = useAuthStore((s) => s.setUser);
  const setBootstrapping = useAuthStore((s) => s.setBootstrapping);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!response.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const data = (await response.json()) as { user?: Parameters<typeof setUser>[0] };
        if (!cancelled) {
          setUser(data.user ?? null);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [setBootstrapping, setUser]);

  return null;
}
