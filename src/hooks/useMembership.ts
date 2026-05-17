'use client';

import { useAuthStore } from '@/store/useAuthStore';
import type { UserMembership } from '@/lib/membership/types';

export function useMembership() {
  const membership: UserMembership = useAuthStore((s) => s.user?.membership ?? 'basic');
  const isPremium = membership === 'premium';
  return {
    membership,
    isPremium,
    isBasic: !isPremium,
  };
}
