import { Suspense } from 'react';
import StockChartsWorkspace from '@/views/StockChartsWorkspace';

function StockChartsFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
      Loading workspace…
    </div>
  );
}

export default function StockChartsPage() {
  return (
    <Suspense fallback={<StockChartsFallback />}>
      <StockChartsWorkspace />
    </Suspense>
  );
}
