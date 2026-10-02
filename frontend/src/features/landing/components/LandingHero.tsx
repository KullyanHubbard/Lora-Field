import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroPreviewImage from '@/assets/Hero-Preview1.png';
import {
  LANDING_GRID,
  LANDING_REVEAL_INITIAL,
  LANDING_REVEAL_TRANSITION,
  LANDING_REVEAL_VISIBLE,
  LANDING_SHELL,
} from '@/features/landing/landingHelpers';

export function LandingHero() {
  const { t } = useTranslation();
  const [isImageError, setIsImageError] = useState(false);

  function handleImageError() {
    setIsImageError(true);
  }

  return (
    <section className="w-full overflow-hidden py-20 md:py-32 lg:py-40">
      <div className={`${LANDING_SHELL} relative`}>
        <div
          className={`absolute inset-0 -z-10 h-full w-full bg-background ${LANDING_GRID} [-webkit-mask-image:radial-gradient(ellipse_60%_150%_at_50%_55%,var(--color-black)_0%,transparent_78%)] [mask-image:radial-gradient(ellipse_60%_150%_at_50%_55%,var(--color-black)_0%,transparent_78%)]`}
        ></div>

        <motion.div
          initial={LANDING_REVEAL_INITIAL}
          animate={LANDING_REVEAL_VISIBLE}
          transition={LANDING_REVEAL_TRANSITION}
          className="mx-auto mb-6 max-w-3xl text-center"
        >
          <h1 className="mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl lg:text-6xl">
            {t('landing.heroTitle')}
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {t('landing.heroSubtitle')}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-lg px-8 text-base">
              <Link to="/login">
                {t('landing.heroCta')}
                <ArrowRight className="ml-2 size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={LANDING_REVEAL_VISIBLE}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative mx-auto"
        >
          <div className="overflow-hidden rounded-xl border border-border/40 bg-gradient-to-b from-background to-muted/20 shadow-2xl">
            {!isImageError && (
              <img
                src={heroPreviewImage}
                onError={handleImageError}
                width={1919}
                height={946}
                alt={t('landing.heroImageAlt')}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-auto w-full"
              />
            )}
            {isImageError && (
              <div className="landing-preview flex w-full items-center justify-center bg-muted text-muted-foreground">
                <p className="text-sm">{t('landing.heroImageFallback')}</p>
              </div>
            )}
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-foreground/10"></div>
          </div>
          <div className="absolute -right-6 -bottom-6 -z-10 size-75 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 opacity-70 blur-3xl"></div>
          <div className="absolute -top-6 -left-6 -z-10 size-75 rounded-full bg-gradient-to-br from-secondary/30 to-primary/30 opacity-70 blur-3xl"></div>
        </motion.div>
      </div>
    </section>
  );
}
