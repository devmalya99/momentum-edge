import { Suspense } from 'react';
import Scanner52wWorkspace from '@/features/scanner/Scanner52wWorkspace';

function ScannerFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
      Loading scanner...
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<ScannerFallback />}>
      <Scanner52wWorkspace />
    </Suspense>
  );
}
