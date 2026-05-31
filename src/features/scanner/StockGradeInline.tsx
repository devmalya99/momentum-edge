'use client';

import { Loader2 } from 'lucide-react';
import { stockGradeBadgeClass, type StockGradeLabel } from '@/lib/ai/stock-grade';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type StockGradeInlineProps = {
  symbolLabel: string;
  grade?: StockGradeLabel;
  reason?: string;
  isLoading?: boolean;
};

export default function StockGradeInline({
  symbolLabel,
  grade,
  reason,
  isLoading = false,
}: StockGradeInlineProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 truncate font-mono text-[11px] font-medium text-gray-300">
        {symbolLabel}
      </span>
      {isLoading ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Grading…
        </span>
      ) : grade ? (
        <TooltipProvider delay={200}>
          <Tooltip>
            <TooltipTrigger
              type="button"
              className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${stockGradeBadgeClass(grade)}`}
            >
              Grade: {grade}
            </TooltipTrigger>
            {reason ? (
              <TooltipContent side="bottom" className="max-w-xs text-left text-[11px] leading-snug">
                {reason}
              </TooltipContent>
            ) : null}
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
