import { TriangleAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ACCENT_TEXT, NOTICE_CLASSES } from '@/lib/toneClasses';
import { cn } from '@/lib/utils';

export function DashboardWarningCard({ message }: { message: string }) {
  return (
    <Card className={NOTICE_CLASSES.warningCard}>
      <CardContent
        className={cn('flex items-center gap-2 rounded-md text-sm font-medium', ACCENT_TEXT.amber)}
      >
        <TriangleAlert className="size-4 shrink-0" /> {message}
      </CardContent>
    </Card>
  );
}
