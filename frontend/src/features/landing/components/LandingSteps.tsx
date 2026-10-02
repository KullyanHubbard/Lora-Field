import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import {
  LANDING_GRID,
  LANDING_REVEAL_INITIAL,
  LANDING_REVEAL_TRANSITION,
  LANDING_REVEAL_VISIBLE,
  LANDING_SHELL,
  LANDING_STAGGER_DELAY,
} from '@/features/landing/landingHelpers';

type StepItem = {
  step: string;
  title: string;
  description: string;
};

export function LandingSteps() {
  const { t } = useTranslation();
  const stepsItems = t('landing.stepsItems', { returnObjects: true }) as StepItem[];

  return (
    <section className="relative w-full overflow-hidden bg-muted/30 py-20 md:py-32">
      <div
        aria-hidden="true"
        className={`absolute inset-0 -z-10 h-full w-full bg-background ${LANDING_GRID} [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,var(--color-black)_40%,transparent_100%)]`}
      />

      <div className={`${LANDING_SHELL} relative`}>
        <motion.div
          initial={LANDING_REVEAL_INITIAL}
          whileInView={LANDING_REVEAL_VISIBLE}
          viewport={{ once: true }}
          transition={LANDING_REVEAL_TRANSITION}
          className="mb-16 flex flex-col items-center justify-center space-y-4 text-center"
        >
          <Badge className="rounded-md px-4 py-1.5 text-sm font-medium" variant="secondary">
            {t('landing.howItWorksBadge')}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            {t('landing.howItWorksTitle')}
          </h2>
          <p className="max-w-200 text-muted-foreground md:text-lg">
            {t('landing.howItWorksSubtitle')}
          </p>
        </motion.div>

        <div className="relative grid gap-8 md:grid-cols-3 md:gap-12">
          {stepsItems.map((step, index) => (
            <motion.div
              key={step.step}
              initial={LANDING_REVEAL_INITIAL}
              whileInView={LANDING_REVEAL_VISIBLE}
              viewport={{ once: true }}
              transition={{ ...LANDING_REVEAL_TRANSITION, delay: index * LANDING_STAGGER_DELAY }}
              className="relative z-10 flex flex-col items-center space-y-4 text-center"
            >
              <h3 className="inline-flex h-20 w-full max-w-xs shrink-0 items-center justify-center rounded-lg bg-primary px-5 py-2 text-lg font-semibold text-primary-foreground shadow-sm">
                {step.title}
              </h3>
              <p className="text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
