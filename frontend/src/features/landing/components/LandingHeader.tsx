import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Menu, X } from 'lucide-react';
import { BrandMark } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/button';
import {
  LANDING_REVEAL_OFFSET,
  LANDING_REVEAL_VISIBLE,
  LANDING_SHELL,
} from '@/features/landing/landingHelpers';

const SCROLLED_HEADER_OFFSET = 10;

type LandingHeaderProps = {
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
};

export function LandingHeader({ isMenuOpen, onMenuToggle, onMenuClose }: LandingHeaderProps) {
  const { t } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > SCROLLED_HEADER_OFFSET);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full backdrop-blur-lg transition-all duration-300 ${isScrolled ? 'bg-background/80 shadow-sm' : 'bg-transparent'}`}
    >
      <div className={`${LANDING_SHELL} relative flex h-16 items-center justify-between`}>
        <BrandMark className="p-0 text-lg font-bold hover:bg-transparent" />
        <nav className="absolute left-1/2 hidden -translate-x-1/2 gap-8 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('landing.navFeatures')}
          </a>
          <a
            href="#faq"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('landing.navFaq')}
          </a>
        </nav>
        <div className="hidden items-center gap-4 md:flex">
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('landing.navLogin')}
          </Link>
          <Button asChild className="rounded-lg">
            <Link to="/register">
              {t('landing.navStart')}
              <ChevronRight className="ml-1 size-4" aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-4 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('landing.toggleMenu')}
            onClick={onMenuToggle}
          >
            {isMenuOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
            <span className="sr-only">{t('landing.toggleMenu')}</span>
          </Button>
        </div>
      </div>
      {/* Mobile menu */}
      <AnimatePresence mode="wait">
        {isMenuOpen ? (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -LANDING_REVEAL_OFFSET }}
            animate={LANDING_REVEAL_VISIBLE}
            exit={{ opacity: 0, y: -LANDING_REVEAL_OFFSET }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-16 border-b bg-background/95 backdrop-blur-lg md:hidden"
          >
            <div className={`${LANDING_SHELL} flex flex-col gap-4 py-4`}>
              <a href="#features" className="py-2 text-sm font-medium" onClick={onMenuClose}>
                {t('landing.navFeatures')}
              </a>
              <a href="#faq" className="py-2 text-sm font-medium" onClick={onMenuClose}>
                {t('landing.navFaq')}
              </a>
              <div className="flex flex-col gap-2 border-t pt-2">
                <Link to="/login" className="py-2 text-sm font-medium" onClick={onMenuClose}>
                  {t('landing.navLogin')}
                </Link>
                <Button asChild className="rounded-lg">
                  <Link to="/register">
                    {t('landing.navStart')}
                    <ChevronRight className="ml-1 size-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
