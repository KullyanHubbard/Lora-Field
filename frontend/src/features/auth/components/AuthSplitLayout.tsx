import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

interface AuthSplitLayoutProps {
  backToHomeLabel: string;
  headline: ReactNode;
  copyright: string;
  privacyPolicyLabel: string;
  children: ReactNode;
}

export function AuthSplitLayout({
  backToHomeLabel,
  headline,
  copyright,
  privacyPolicyLabel,
  children,
}: AuthSplitLayoutProps) {
  return (
    <div className="flex min-h-svh">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-primary/80 p-10 lg:flex lg:w-1/2 lg:flex-col">
        <div className="pointer-events-none absolute inset-0 text-foreground/50 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />
        <div className="pointer-events-none absolute left-1/4 top-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/30 blur-3xl" />

        <Link
          to="/"
          aria-label={backToHomeLabel}
          className="relative z-10 -mx-2 flex self-start items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-primary-foreground/10 active:bg-primary-foreground/20"
        >
          <span className="text-2xl font-semibold text-primary-foreground">LoraField</span>
        </Link>

        <div className="relative z-10 flex flex-1 flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <h1 className="text-6xl font-bold leading-tight tracking-tight text-primary-foreground">
              {headline}
            </h1>
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-primary-foreground/70">
          <span>{copyright}</span>
          <a href="#" className="transition-colors hover:text-primary-foreground">
            {privacyPolicyLabel}
          </a>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background px-4 py-8 sm:p-8 lg:w-1/2">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            aria-label={backToHomeLabel}
            className="-mx-2 mb-8 flex self-start items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-accent active:bg-accent/80 lg:hidden"
          >
            <span className="text-lg font-semibold text-foreground">LoraField</span>
          </Link>

          {children}
        </div>
      </div>
    </div>
  );
}
