'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MembershipBenefitsModal } from '@/components/membership/MembershipBenefitsModal';
import { useMembershipUpgradeStore } from '@/store/useMembershipUpgradeStore';

type ProfilePayload = {
  membershipOffer?: { amountLabel: string };
};

export function MembershipProvider() {
  const setAmountLabel = useMembershipUpgradeStore((s) => s.setAmountLabel);

  const profileQuery = useQuery({
    queryKey: ['profile', 'membership-offer'],
    queryFn: async () => {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      if (!res.ok) return null;
      return (await res.json()) as ProfilePayload;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const label = profileQuery.data?.membershipOffer?.amountLabel;
    if (label) setAmountLabel(label);
  }, [profileQuery.data?.membershipOffer?.amountLabel, setAmountLabel]);

  return <MembershipBenefitsModal />;
}
