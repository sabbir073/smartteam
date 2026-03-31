import { Skeleton } from "@/components/ui/skeleton";

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-48" /></div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
