'use client';

import { Button } from '@/components/ui/button';
import { BASIC_WATCHLIST_LIMIT, membershipLabel } from '@/lib/membership/constants';
import { useMembership } from '@/hooks/useMembership';
import { useMembershipUpgradeStore } from '@/store/useMembershipUpgradeStore';
import type { UserMembership } from '@/lib/membership/types';

type MembershipCardProps = {
  membership: UserMembership;
  amountLabel?: string;
};

export function MembershipCard({ membership, amountLabel }: MembershipCardProps) {
  const { isPremium } = useMembership();
  const openMembershipUpgrade = useMembershipUpgradeStore((s) => s.openMembershipUpgrade);
  const tier = isPremium ? 'premium' : membership;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Membership</h2>
        <span
          className={
            tier === 'premium'
              ? 'inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300'
              : 'inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gray-300'
          }
        >
          {membershipLabel(tier)}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-400">
        {tier === 'premium'
          ? 'You have AI features across the app and unlimited watchlist symbols.'
          : `Basic includes up to ${BASIC_WATCHLIST_LIMIT} watchlist symbols. Upgrade for AI tools and unlimited watchlist.`}
      </p>
      {tier !== 'premium' && amountLabel && (
        <p className="mt-2 text-sm text-cyan-300/90">Premium: {amountLabel}</p>
      )}
      {tier !== 'premium' && (
        <Button
          type="button"
          className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-110"
          onClick={() => openMembershipUpgrade('generic', amountLabel ?? null)}
        >
          Buy Membership
        </Button>
      )}
    </section>
  );
}
