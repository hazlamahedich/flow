import { Skeleton } from '@flow/ui';

export function TimelineSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-full w-px" />
          </div>
          <div className="flex-1 pb-8">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
