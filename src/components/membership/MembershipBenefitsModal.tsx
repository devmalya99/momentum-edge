'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MEMBERSHIP_BENEFITS,
  membershipLabel,
  upgradeReasonHeadline,
  upgradeReasonSubtitle,
} from '@/lib/membership/constants';
import { startMembershipCheckout } from '@/lib/membership/checkout-client';
import { useMembership } from '@/hooks/useMembership';
import { useAuthStore } from '@/store/useAuthStore';
import { useMembershipUpgradeStore } from '@/store/useMembershipUpgradeStore';
import type { MembershipUpgradeReason, UserMembership } from '@/lib/membership/types';

export function MembershipBenefitsModal() {
  const queryClient = useQueryClient();
  const { open, reason, amountLabel, closeMembershipUpgrade } = useMembershipUpgradeStore();
  const { isPremium, membership } = useMembership();
  const setUser = useAuthStore((s) => s.setUser);
  const authUser = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleContinueToPay() {
    setBusy(true);
    setError('');
    try {
      const result = await startMembershipCheckout();
      if (result === 'paid') {
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        if (authUser) {
          setUser({ ...authUser, membership: 'premium' });
        }
        closeMembershipUpgrade();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <MembershipModalBackdrop onClose={closeMembershipUpgrade}>
      <StopClickPropagation>
        <div className="relative max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#12151b] p-6 shadow-2xl">
          <button
            type="button"
            className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"
            onClick={closeMembershipUpgrade}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <MembershipModalHeader isPremium={isPremium} membership={membership} reason={reason} />

          <ul className="mt-6 space-y-4">
            {MEMBERSHIP_BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{benefit.title}</p>
                  <p className="mt-0.5 text-sm text-gray-400">{benefit.description}</p>
                </div>
              </li>
            ))}
          </ul>

          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

          <div className="mt-8 flex flex-col gap-2">
            {isPremium ? (
              <Button type="button" className="w-full" onClick={closeMembershipUpgrade}>
                Done
              </Button>
            ) : (
              <>
                {amountLabel ? (
                  <p className="text-center text-sm text-cyan-300/90">
                    One-time payment: <span className="font-semibold">{amountLabel}</span>
                  </p>
                ) : null}
                <Button
                  type="button"
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-110"
                  disabled={busy}
                  onClick={() => void handleContinueToPay()}
                >
                  {busy ? 'Opening checkout…' : 'Continue to payment'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-400"
                  onClick={closeMembershipUpgrade}
                >
                  Maybe later
                </Button>
              </>
            )}
          </div>
        </div>
      </StopClickPropagation>
    </MembershipModalBackdrop>
  );
}

function MembershipModalBackdrop({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0a0a0b]/85 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function StopClickPropagation({ children }: { children: ReactNode }) {
  return <MembershipModalStop onClick={(e: MouseEvent) => e.stopPropagation()}>{children}</MembershipModalStop>;
}

function MembershipModalStop({ children, onClick }: { children: ReactNode; onClick: (e: MouseEvent) => void }) {
  return <div onClick={onClick}>{children}</div>;
}

function MembershipModalHeader({
  isPremium,
  membership,
  reason,
}: {
  isPremium: boolean;
  membership: UserMembership;
  reason: MembershipUpgradeReason;
}) {
  return (
    <div className="flex items-start gap-4 pr-8">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 text-amber-300">
        <Sparkles className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/90">
          {isPremium ? 'Your plan' : 'Premium membership'}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {isPremium ? `${membershipLabel(membership)} active` : upgradeReasonHeadline(reason)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          {isPremium
            ? 'You have full access to AI features and unlimited watchlist symbols.'
            : upgradeReasonSubtitle(reason)}
        </p>
      </div>
    </div>
  );
}
