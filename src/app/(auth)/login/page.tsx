'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthCard } from '@/components/auth/AuthCard';
import { loginSchema } from '@/lib/auth/schemas';
import { useAuthStore } from '@/store/useAuthStore';

type AuthResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    tradingExperience: string;
    imageUrl: string;
  };
  error?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const parsed = loginSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = (await response.json()) as AuthResponse;
      if (!response.ok) {
        throw new Error(data.error ?? 'Login failed');
      }
      return data.user;
    },
    onSuccess: (user) => {
      setUser(user);
      router.push('/dashboard');
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : 'Login failed');
    },
  });

  return (
    <div className="w-full max-w-md">
      <AuthCard
        title="Welcome Back"
        subtitle="Log in to continue building your market edge."
        footerText="New to Momentum Edge?"
        footerLinkText="Create account"
        footerLinkHref="/signup"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            loginMutation.mutate(form);
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-gray-400">Email</span>
            <input
              type="email"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-cyan-400/50"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-gray-400">
              Password
            </span>
            <input
              type="password"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-cyan-400/50"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
            />
          </label>

          {error && <p className="text-sm text-rose-300">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </AuthCard>

      <p className="mt-4 text-center text-sm text-gray-400">
        <Link href="/" className="text-cyan-300 hover:text-cyan-200">
          Back to home
        </Link>
      </p>
    </div>
  );
}
