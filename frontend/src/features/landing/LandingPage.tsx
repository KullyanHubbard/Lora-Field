import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingHeader } from '@/features/landing/components/LandingHeader';
import { LandingHero } from '@/features/landing/components/LandingHero';
import { LandingFeatures } from '@/features/landing/components/LandingFeatures';
import { LandingSteps } from '@/features/landing/components/LandingSteps';
import { LandingFaq } from '@/features/landing/components/LandingFaq';
import {
  LANDING_GRID,
  LANDING_REVEAL_INITIAL,
  LANDING_REVEAL_TRANSITION,
  LANDING_REVEAL_VISIBLE,
  LANDING_SHELL,
} from '@/features/landing/landingHelpers';
import './LandingPage.css';

export default function LandingPage() {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function handleMenuToggle() {
    setIsMenuOpen((isOpen) => !isOpen);
  }

  function handleMenuClose() {
    setIsMenuOpen(false);
  }

  return (
    <div className="landing-page flex min-h-dvh flex-col text-foreground">
      <LandingHeader
        isMenuOpen={isMenuOpen}
        onMenuToggle={handleMenuToggle}
        onMenuClose={handleMenuClose}
      />
      <main className="flex-1">
        <LandingHero />

        <LandingFeatures />

        <LandingSteps />

        <LandingFaq />

        {/* Ajakan penutup */}
        <section className="relative w-full overflow-hidden bg-gradient-to-br from-primary to-primary/80 py-20 text-primary-foreground md:py-32">
          <div className={`absolute inset-0 -z-10 ${LANDING_GRID}`}></div>
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-foreground/10 blur-3xl"></div>
          <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-foreground/10 blur-3xl"></div>

          <div className={`${LANDING_SHELL} relative`}>
            <motion.div
              initial={LANDING_REVEAL_INITIAL}
              whileInView={LANDING_REVEAL_VISIBLE}
              viewport={{ once: true }}
              transition={LANDING_REVEAL_TRANSITION}
              className="flex flex-col items-center justify-center space-y-6 text-center"
            >
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                {t('landing.ctaTitle')}
              </h2>
              <p className="mx-auto max-w-175 text-primary-foreground/80 md:text-xl">
                {t('landing.ctaSubtitle')}
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="h-12 rounded-lg px-8 text-base"
                >
                  <Link to="/login">
                    {t('landing.ctaButton')}
                    <ArrowRight className="ml-2 size-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <footer className="w-full border-t bg-background/95 backdrop-blur-sm">
        <div className={`${LANDING_SHELL} flex flex-col gap-8 py-10 lg:py-16`}>
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-4">
              <span className="text-lg font-bold">{t('landing.footerAbout')}</span>
              <p className="text-sm text-muted-foreground">{t('landing.footerAboutDesc')}</p>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold">{t('landing.footerNav')}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#features"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    onClick={handleMenuClose}
                  >
                    {t('landing.footerFeatures')}
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    onClick={handleMenuClose}
                  >
                    {t('landing.footerFaq')}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
