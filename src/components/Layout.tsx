'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  BarChart2,
  ShieldCheck,
  Menu,
  X,
  PieChart,
  Globe,
  ScanSearch,
  Bookmark,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'entry', label: 'New Trade', icon: PlusCircle, href: '/entry' },
  { id: 'rules', label: 'Scoring Rules', icon: ShieldCheck, href: '/rules' },
  { id: 'networth', label: 'Networth', icon: PieChart, href: '/networth' },
  { id: 'analytics', label: 'Analytics', icon: BarChart2, href: '/analytics' },
  { id: 'market-view', label: 'Market View', icon: Globe, href: '/market-view' },
  { id: '52h-scanner', label: '52 H Scanner', icon: ScanSearch, href: '/52w-scanner' },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark, href: '/watchlist' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
] as const;

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();

  const wideContent =
    pathname === '/stock-charts' || pathname === '/52w-scanner' || pathname === '/watchlist';

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-gray-100 font-sans selection:bg-blue-500/30">
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen transition-all duration-300 border-r border-white/5 bg-[#0f0f11]',
          isSidebarOpen ? 'w-64' : 'w-20',
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-6 border-b border-white/5">
            {isSidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"
              >
                MOMENTUM EDGE
              </motion.span>
            )}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'flex items-center w-full px-3 py-2.5 rounded-xl transition-all duration-200 group',
                    isActive
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200',
                  )}
                >
                  <item.icon
                    size={22}
                    className={cn(
                      'transition-transform duration-200',
                      isActive ? 'scale-110' : 'group-hover:scale-110',
                    )}
                  />
                  {isSidebarOpen && (
                    <span className="ml-3 font-medium text-sm">{item.label}</span>
                  )}
                  {isActive && isSidebarOpen && (
                    <motion.div
                      layoutId="active-pill"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/5">
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5',
                !isSidebarOpen && 'justify-center',
              )}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold">
                DM
              </div>
              {isSidebarOpen && (
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-medium truncate">Debmalyamazumdar</span>
                  <span className="text-[10px] text-gray-500 truncate">Pro Trader</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main
        className={cn(
          'transition-all duration-300 min-h-screen',
          isSidebarOpen ? 'pl-64' : 'pl-20',
        )}
      >
        <div
          className={cn(
            'mx-auto w-full px-6 py-8',
            wideContent ? 'max-w-[min(100%,1820px)]' : 'max-w-7xl',
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
