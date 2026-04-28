'use client';

import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type InfoTooltipProps = {
  message: string;
};

export default function InfoTooltip({ message }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          aria-label="More information"
          className="inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50"
        >
          <Info size={14} />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs leading-relaxed text-[11px] text-gray-100">
          {message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
