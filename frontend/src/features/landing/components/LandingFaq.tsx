import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  LANDING_REVEAL_INITIAL,
  LANDING_REVEAL_TRANSITION,
  LANDING_REVEAL_VISIBLE,
  LANDING_SHELL,
} from '@/features/landing/landingHelpers';

const FAQ_REVEAL_OFFSET = 10;
const FAQ_REVEAL_DURATION = 0.3;
const FAQ_STAGGER_DELAY = 0.05;
const FAQ_REVEAL_INITIAL = { opacity: 0, y: FAQ_REVEAL_OFFSET };

type FaqItem = {
  question: string;
  answer: string;
};

export function LandingFaq() {
  const { t } = useTranslation();
  const faqItems = t('landing.faqItems', { returnObjects: true }) as FaqItem[];

  return (
    <section id="faq" className="w-full py-20 md:py-32">
      <div className={LANDING_SHELL}>
        <motion.div
          initial={LANDING_REVEAL_INITIAL}
          whileInView={LANDING_REVEAL_VISIBLE}
          viewport={{ once: true }}
          transition={LANDING_REVEAL_TRANSITION}
          className="mb-12 flex flex-col items-center justify-center space-y-4 text-center"
        >
          <Badge className="rounded-md px-4 py-1.5 text-sm font-medium" variant="secondary">
            {t('landing.navFaq')}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('landing.faqTitle')}</h2>
          <p className="max-w-200 text-muted-foreground md:text-lg">{t('landing.faqSubtitle')}</p>
        </motion.div>

        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((faq, index) => (
              <motion.div
                key={faq.question}
                initial={FAQ_REVEAL_INITIAL}
                whileInView={LANDING_REVEAL_VISIBLE}
                viewport={{ once: true }}
                transition={{ duration: FAQ_REVEAL_DURATION, delay: index * FAQ_STAGGER_DELAY }}
              >
                <AccordionItem value={`item-${index}`} className="border-b border-border/40 py-2">
                  <AccordionTrigger className="text-left font-medium hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
