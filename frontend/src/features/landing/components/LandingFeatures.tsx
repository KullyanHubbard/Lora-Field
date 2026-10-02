import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Activity, CloudSun, Droplets, History, MapPin, Sprout } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  LANDING_REVEAL_INITIAL,
  LANDING_REVEAL_TRANSITION,
  LANDING_REVEAL_VISIBLE,
  LANDING_SHELL,
  LANDING_STAGGER_DELAY,
} from '@/features/landing/landingHelpers';

const FEATURE_CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: LANDING_STAGGER_DELAY },
  },
};

const FEATURE_ITEM_VARIANTS = {
  hidden: LANDING_REVEAL_INITIAL,
  show: LANDING_REVEAL_VISIBLE,
};

// Ikon statis, digabung ke teks i18n saat render.
const FEATURE_ICONS = [
  <Activity aria-hidden="true" className="size-6" key="activity" />,
  <Droplets aria-hidden="true" className="size-6" key="droplets" />,
  <CloudSun aria-hidden="true" className="size-6" key="cloudsun" />,
  <Sprout aria-hidden="true" className="size-6" key="sprout" />,
  <MapPin aria-hidden="true" className="size-6" key="mappin" />,
  <History aria-hidden="true" className="size-6" key="history" />,
];

type FeatureItem = {
  title: string;
  description: string;
};

export function LandingFeatures() {
  const { t } = useTranslation();
  const featuresItems = t('landing.featuresItems', { returnObjects: true }) as FeatureItem[];

  return (
    <section id="features" className="w-full py-20 md:py-32">
      <div className={LANDING_SHELL}>
        <motion.div
          initial={LANDING_REVEAL_INITIAL}
          whileInView={LANDING_REVEAL_VISIBLE}
          viewport={{ once: true }}
          transition={LANDING_REVEAL_TRANSITION}
          className="mb-12 flex flex-col items-center justify-center space-y-4 text-center"
        >
          <Badge className="rounded-md px-4 py-1.5 text-sm font-medium" variant="secondary">
            {t('landing.featuresBadge')}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            {t('landing.featuresTitle')}
          </h2>
          <p className="max-w-200 text-muted-foreground md:text-lg">
            {t('landing.featuresSubtitle')}
          </p>
        </motion.div>

        <motion.div
          variants={FEATURE_CONTAINER_VARIANTS}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {featuresItems.map((feature, index) => (
            <motion.div key={feature.title} variants={FEATURE_ITEM_VARIANTS}>
              <Card className="h-full overflow-hidden border border-border/40 bg-gradient-to-b from-background to-muted/10 py-0 backdrop-blur transition-all hover:shadow-md">
                <CardContent className="flex h-full flex-col p-6">
                  <div className="mb-4 text-primary">{FEATURE_ICONS[index]}</div>
                  <h3 className="mb-2 text-xl font-bold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
