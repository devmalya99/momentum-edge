'use client';

import { useCallback } from 'react';
import { useMembership } from '@/hooks/useMembership';
import { useMembershipUpgradeStore } from '@/store/useMembershipUpgradeStore';

/** Blocks AI UI for Basic users and opens the membership upgrade modal. */
export function usePremiumAiGate() {
  const { isPremium } = useMembership();
  const openMembershipUpgrade = useMembershipUpgradeStore((s) => s.openMembershipUpgrade);

  const requirePremiumForAi = useCallback(
    (onAllowed: () => void): void => {
      if (isPremium) {
        onAllowed();
        return;
      }
      openMembershipUpgrade('ai');
    },
    [isPremium, openMembershipUpgrade],
  );

  const guardAiSheetOpen = useCallback(
    (requestedOpen: boolean, setOpen: (open: boolean) => void): void => {
      if (requestedOpen && !isPremium) {
        openMembershipUpgrade('ai');
        return;
      }
      setOpen(requestedOpen);
    },
    [isPremium, openMembershipUpgrade],
  );

  return { isPremium, requirePremiumForAi, guardAiSheetOpen };
}
