import { normalizeUserMembership, type UserRow } from '@/lib/db/users';
import type { UserMembership } from '@/lib/membership/types';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  membership: UserMembership;
  tradingExperience: string;
  imageUrl: string;
};

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    membership: normalizeUserMembership(user.membership),
    tradingExperience: user.trading_experience ?? '',
    imageUrl: user.image_url ?? '',
  };
}
