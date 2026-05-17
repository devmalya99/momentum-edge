export function getRazorpayKeyId(): string {
  const key = process.env.RAZORPAY_KEY_ID?.trim() || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  if (!key) throw new Error('RAZORPAY_KEY_ID is not set');
  return key;
}

export function getRazorpayKeySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET is not set');
  return secret;
}

/** Default ₹1 in test (100 paise). Override with RAZORPAY_PREMIUM_AMOUNT_PAISE. */
export function getPremiumAmountPaise(): number {
  const raw = process.env.RAZORPAY_PREMIUM_AMOUNT_PAISE?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 100;
}

export function formatInrFromPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
