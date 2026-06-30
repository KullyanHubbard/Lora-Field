import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function readPrefillEmail(): string {
  try {
    const prefill = sessionStorage.getItem('lf_prefill_email');
    if (prefill) {
      sessionStorage.removeItem('lf_prefill_email');
      return prefill;
    }
  } catch {
    // sessionStorage tidak tersedia di sebagian konteks
  }
  return '';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState(readPrefillEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError(t('auth.login.errorRequired'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(trimmedEmail, trimmedPassword);
      const redirectTo = location.state?.from?.pathname ?? '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError((err as Error).message || t('auth.login.errorFallback'));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-svh">
      {/* Panel kiri — branding */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 flex-col bg-gradient-to-br from-primary to-primary/80 p-10">
        {/* Dekorasi: pola dot-grid (currentColor + opacity token) */}
        <div className="pointer-events-none absolute inset-0 text-foreground/50 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />
        {/* Dekorasi: glow lembut di belakang headline */}
        <div className="pointer-events-none absolute left-1/4 top-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/30 blur-3xl" />

        <Link
          to="/"
          aria-label={t('auth.login.backToHome')}
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
              {t('auth.login.headlineLine1')}<br />{t('auth.login.headlineLine2')}
            </h1>
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-primary-foreground/70">
          <span>{t('auth.login.copyright')}</span>
          <a href="#" className="transition-colors hover:text-primary-foreground">
            {t('auth.login.privacyPolicy')}
          </a>
        </div>
      </div>

      {/* Panel kanan — form */}
      <div className="flex w-full items-center justify-center bg-background px-4 py-8 sm:p-8 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Logo hanya tampil di mobile */}
          <Link
            to="/"
            aria-label={t('auth.login.backToHome')}
            className="-mx-2 mb-8 flex self-start items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-accent active:bg-accent/80 lg:hidden"
          >
            <span className="text-lg font-semibold text-foreground">LoraField</span>
          </Link>

          <h2 className="text-2xl font-bold text-foreground">{t('auth.login.title')}</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="mt-6 space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="login-email">{t('auth.login.emailLabel')}</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder={t('auth.login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">{t('auth.login.passwordLabel')}</Label>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                placeholder={t('auth.login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <span className="relative inline-flex">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer size-4 cursor-pointer appearance-none rounded border border-input bg-transparent transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                  <Check className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-primary-foreground peer-checked:block" />
                </span>
                {t('auth.login.rememberMe')}
              </label>
              <Link
                to="/reset-password"
                className="text-sm text-primary hover:underline"
              >
                {t('auth.login.forgotPassword')}
              </Link>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="status" aria-live="polite">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              aria-busy={submitting}
            >
              <LogIn className="size-4" />
              {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs uppercase tracking-wide text-muted-foreground">
                {t('auth.login.orLoginWith')}
              </span>
            </div>
          </div>

          {/* Tombol social — placeholder, belum ada integrasi OAuth */}
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" className="gap-2">
              <GoogleIcon />
              Google
            </Button>
            <Button type="button" variant="outline" className="gap-2">
              <AppleIcon />
              Apple
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.login.noAccount')}{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t('auth.login.registerLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}
