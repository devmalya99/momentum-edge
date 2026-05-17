import type { MembershipUpgradeReason } from '@/lib/membership/types';

/** Max watchlist symbols for Basic members (across all lists). */
export const BASIC_WATCHLIST_LIMIT = 25;

export const PREMIUM_REQUIRED_CODE = 'premium_required';

export const MEMBERSHIP_BENEFITS = [
  {
    title: 'AI across the app',
    description:
      'Quantamental stock overviews, scan analysis, market desk AI, and trigger insights — powered on every screen that supports AI.',
  },
  {
    title: 'Unlimited watchlist',
    description:
      'Track as many equities and index baskets as you need. Basic is capped at 25 symbols.',
  },
  {
    title: 'Priority experience',
    description:
      'Full access to premium workflows as we ship new AI and scanner capabilities.',
  },
] as const;

export function membershipLabel(membership: 'basic' | 'premium'): string {
  return membership === 'premium' ? 'Premium' : 'Basic';
}

export function upgradeReasonHeadline(reason: MembershipUpgradeReason): string {
  switch (reason) {
    case 'ai':
      return 'Unlock AI-powered analysis';
    case 'watchlist':
      return 'Unlock unlimited watchlist';
    default:
      return 'Upgrade to Premium';
  }
}

export function upgradeReasonSubtitle(reason: MembershipUpgradeReason): string {
  switch (reason) {
    case 'ai':
      return 'Premium membership enables AI features across scanner, watchlist, and market tools.';
    case 'watchlist':
      return `You've reached the Basic limit of ${BASIC_WATCHLIST_LIMIT} symbols. Upgrade for unlimited tracking.`;
    default:
      return 'Get AI features and unlimited watchlist stocks with Premium membership.';
  }
}
