'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { clsx } from 'clsx';

type SectionInfoProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Accessible “i” control: click toggles a short explainer (works on touch; closes on outside click).
 */
export function SectionInfo({ label, children, className }: SectionInfoProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className={clsx('relative inline-flex items-center align-middle', className)} ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded-lg text-gray-500 hover:text-sky-400 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
        aria-label={`Help: ${label}`}
        aria-expanded={open}
        aria-controls={headingId}
      >
        <Info size={17} strokeWidth={2} className="shrink-0" />
      </button>
      {open && (
        <div
          id={headingId}
          role="region"
          className="absolute z-[60] left-0 top-[calc(100%+6px)] w-[min(92vw,24rem)] p-4 rounded-2xl bg-[#1a1a1d] border border-white/12 shadow-[0_12px_40px_rgba(0,0,0,0.55)] text-[13px] text-gray-300 leading-relaxed"
        >
          <div className="font-bold text-white mb-2 text-[11px] uppercase tracking-wider">{label}</div>
          <div className="space-y-2.5">{children}</div>
        </div>
      )}
    </div>
  );
}

export function SectionTitleRow({
  title,
  infoLabel,
  children,
}: {
  title: string;
  infoLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <h3 className="text-lg font-bold leading-tight">{title}</h3>
      <SectionInfo label={infoLabel}>{children}</SectionInfo>
    </div>
  );
}
