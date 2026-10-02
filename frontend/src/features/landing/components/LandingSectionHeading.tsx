import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import {
  LANDING_REVEAL_INITIAL,
  LANDING_REVEAL_TRANSITION,
  LANDING_REVEAL_VISIBLE,
} from '@/features/landing/landingHelpers';
import { cn } from '@/lib/utils';

// Judul seksi landing (Fitur, Langkah, FAQ): label kecil, judul, dan subjudul di tengah.
export function LandingSectionHeading({
  badge,
  title,
  subtitle,
  className,
}: {
  badge: string;
  title: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={LANDING_REVEAL_INITIAL}
      whileInView={LANDING_REVEAL_VISIBLE}
      viewport={{ once: true }}
      transition={LANDING_REVEAL_TRANSITION}
      className={cn(className, 'flex flex-col items-center justify-center space-y-4 text-center')}
    >
      <Badge className="rounded-md px-4 py-1.5 text-sm font-medium" variant="secondary">
        {badge}
      </Badge>
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      <p className="max-w-200 text-muted-foreground md:text-lg">{subtitle}</p>
    </motion.div>
  );
}
