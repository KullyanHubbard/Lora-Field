import { TriangleAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function DashboardWarningCard({ message }: { message: string }) {
  return (
    <Card className="border-amber-500/20 bg-amber-500/10">
      <CardContent className="flex items-center gap-2 rounded-md text-sm font-medium text-amber-500 dark:text-amber-400">
        <TriangleAlert className="size-4 shrink-0" /> {message}
      </CardContent>
    </Card>
  );
}
