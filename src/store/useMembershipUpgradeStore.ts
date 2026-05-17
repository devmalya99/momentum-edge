'use client';

import { create } from 'zustand';
import type { MembershipUpgradeReason } from '@/lib/membership/types';

type MembershipUpgradeState = {
  open: boolean;
  reason: MembershipUpgradeReason;
  amountLabel: string | null;
  openMembershipUpgrade: (reason?: MembershipUpgradeReason, amountLabel?: string | null) => void;
  closeMembershipUpgrade: () => void;
  setAmountLabel: (amountLabel: string | null) => void;
};

export const useMembershipUpgradeStore = create<MembershipUpgradeState>((set) => ({
  open: false,
  reason: 'generic',
  amountLabel: null,
  openMembershipUpgrade: (reason = 'generic', amountLabel = null) =>
    set({ open: true, reason, amountLabel }),
  closeMembershipUpgrade: () => set({ open: false }),
  setAmountLabel: (amountLabel) => set({ amountLabel }),
}));
