import { PREMIUM_REQUIRED_CODE } from '@/lib/membership/constants';

export function isPremiumRequiredApiError(
  status: number,
  body: { code?: string } | null | undefined,
): boolean {
  return status === 403 && body?.code === PREMIUM_REQUIRED_CODE;
}
