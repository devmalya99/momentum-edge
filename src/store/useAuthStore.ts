'use client';

import { create } from 'zustand';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  tradingExperience: string;
  imageUrl: string;
};

type AuthState = {
  user: AuthUser | null;
  isBootstrapping: boolean;
  setUser: (user: AuthUser | null) => void;
  setBootstrapping: (value: boolean) => void;
  logoutLocal: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isBootstrapping: true,
  setUser: (user) => set({ user }),
  setBootstrapping: (value) => set({ isBootstrapping: value }),
  logoutLocal: () => set({ user: null, isBootstrapping: false }),
}));
