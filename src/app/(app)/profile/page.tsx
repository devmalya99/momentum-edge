'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  tradingExperience: string;
  imageUrl: string;
};

type ProfileResponse = {
  user?: ProfileUser;
  error?: string;
};

export default function ProfilePage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({
    name: '',
    email: '',
    tradingExperience: '',
    imageUrl: '',
    currentPassword: '',
    newPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      const data = (await response.json()) as ProfileResponse;
      if (!response.ok || !data.user) {
        throw new Error(data.error ?? 'Failed to load profile');
      }
      return data.user;
    },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setForm((prev) => ({
      ...prev,
      name: profileQuery.data.name,
      email: profileQuery.data.email,
      tradingExperience: profileQuery.data.tradingExperience,
      imageUrl: profileQuery.data.imageUrl,
    }));
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as ProfileResponse;
      if (!response.ok || !data.user) {
        throw new Error(data.error ?? 'Failed to update profile');
      }
      return data.user;
    },
    onSuccess: (user) => {
      setUser(user);
      setMessage('Profile updated successfully');
      setError('');
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : 'Failed to update profile');
      setMessage('');
    },
  });

  if (profileQuery.isLoading) {
    return <div className="text-sm text-gray-400">Loading profile...</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white">My Profile</h1>
        <p className="mt-2 text-sm text-gray-400">
          Update your trader identity, experience, and account security.
        </p>
      </header>

      <form
        className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-gray-400">Name</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-gray-400">Email</span>
            <input
              type="email"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-gray-400">
            Trading Experience
          </span>
          <input
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
            value={form.tradingExperience}
            onChange={(e) => setForm((p) => ({ ...p, tradingExperience: e.target.value }))}
            placeholder="Example: Swing trader | 4 years"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-gray-400">
            Profile Image URL
          </span>
          <input
            type="url"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
            value={form.imageUrl}
            onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
            placeholder="https://..."
          />
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-gray-400">
              Current Password
            </span>
            <input
              type="password"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
              value={form.currentPassword}
              onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-gray-400">
              New Password
            </span>
            <input
              type="password"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-cyan-400/50"
              value={form.newPassword}
              onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
            />
          </label>
        </div>

        {message && <p className="text-sm text-emerald-300">{message}</p>}
        {error && <p className="text-sm text-rose-300">{error}</p>}

        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
