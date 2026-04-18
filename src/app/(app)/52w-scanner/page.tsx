import { Suspense } from 'react';
import Scanner52wWorkspace from '@/features/52wScanner/Scanner52wWorkspace';

function Scanner52wFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
      Loading scanner...
    </div>
  );
}

export default function Scanner52wPage() {
  return (
    <Suspense fallback={<Scanner52wFallback />}>
      <Scanner52wWorkspace />
    </Suspense>
  );
}
