import { Suspense } from 'react';
import WatchlistWorkspace from '@/features/watchlist/WatchlistWorkspace';

function WatchlistFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
      Loading watchlist...
    </div>
  );
}

export default function WatchlistPage() {
  return (
    <Suspense fallback={<WatchlistFallback />}>
      <WatchlistWorkspace />
    </Suspense>
  );
}
