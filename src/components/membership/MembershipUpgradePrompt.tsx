'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { upgradeReasonHeadline, upgradeReasonSubtitle } from '@/lib/membership/constants';
import type { MembershipUpgradeReason } from '@/lib/membership/types';
import { useMembershipUpgradeStore } from '@/store/useMembershipUpgradeStore';

type MembershipUpgradePromptProps = {
  reason?: MembershipUpgradeReason;
  className?: string;
};

export function MembershipUpgradePrompt({
  reason = 'generic',
  className = '',
}: MembershipUpgradePromptProps) {
  const openMembershipUpgrade = useMembershipUpgradeStore((s) => s.openMembershipUpgrade);

  return (
    <div
      className={`rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-center ${className}`}
    >
      <Sparkles className="mx-auto h-8 w-8 text-amber-300" aria-hidden />
      <p className="mt-3 text-sm font-semibold text-white">{upgradeReasonHeadline(reason)}</p>
      <p className="mt-2 text-sm text-gray-400">{upgradeReasonSubtitle(reason)}</p>
      <Button
        type="button"
        className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-110"
        onClick={() => openMembershipUpgrade(reason)}
      >
        View membership benefits
      </Button>
    </div>
  );
}
