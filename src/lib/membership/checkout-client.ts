type CreateOrderResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  amountLabel: string;
  prefill: { name: string; email: string };
  error?: string;
};

type VerifyPaymentResponse = {
  ok?: boolean;
  membership?: 'premium';
  error?: string;
};

function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error('Razorpay checkout failed to load'));
    };
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
}

export async function startMembershipCheckout(): Promise<'paid' | 'dismissed'> {
  const orderRes = await fetch('/api/razorpay/create-order', { method: 'POST' });
  const orderData = (await orderRes.json()) as CreateOrderResponse;
  if (!orderRes.ok) {
    throw new Error(orderData.error ?? 'Could not start checkout');
  }

  const Razorpay = await loadRazorpayCheckout();

  return new Promise<'paid' | 'dismissed'>((resolve, reject) => {
    const rzp = new Razorpay({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'Momentum Edge',
      description: 'Premium membership',
      order_id: orderData.orderId,
      prefill: orderData.prefill,
      theme: { color: '#06b6d4' },
      handler: async (response) => {
        try {
          const verifyRes = await fetch('/api/razorpay/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          const verifyData = (await verifyRes.json()) as VerifyPaymentResponse;
          if (!verifyRes.ok || !verifyData.ok) {
            throw new Error(verifyData.error ?? 'Payment verification failed');
          }
          resolve('paid');
        } catch (e) {
          reject(e);
        }
      },
      modal: {
        ondismiss: () => resolve('dismissed'),
      },
    });
    rzp.open();
  });
}
