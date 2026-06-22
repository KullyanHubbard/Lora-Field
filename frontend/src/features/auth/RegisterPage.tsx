import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useRegister } from './queries';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterPage() {
  const register = useRegister();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError(t('auth.register.errorNameRequired'));
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError(t('auth.register.errorEmailInvalid'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.register.errorPasswordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.register.errorPasswordMismatch'));
      return;
    }
    setError('');
    register.mutate({ name: trimmedName, email: trimmedEmail, password });
  };

  return (
    <div className="flex min-h-svh">
      {/* Panel kiri — branding */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 flex-col bg-gradient-to-br from-primary to-primary/80 p-10">
        {/* Dekorasi: pola dot-grid */}
        <div className="pointer-events-none absolute inset-0 text-foreground/50 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />
        {/* Dekorasi: glow lembut di belakang headline */}
        <div className="pointer-events-none absolute left-1/4 top-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/30 blur-3xl" />

        <Link
          to="/"
          aria-label={t('auth.register.backToHome')}
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
              {t('auth.register.headline')}
            </h1>
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-primary-foreground/70">
          <span>{t('auth.register.copyright')}</span>
          <a href="#" className="transition-colors hover:text-primary-foreground">
            {t('auth.register.privacyPolicy')}
          </a>
        </div>
      </div>

      {/* Panel kanan — form */}
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Logo hanya tampil di mobile */}
          <Link
            to="/"
            aria-label={t('auth.register.backToHome')}
            className="-mx-2 mb-8 flex self-start items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-accent active:bg-accent/80 lg:hidden"
          >
            <span className="text-lg font-semibold text-foreground">LoraField</span>
          </Link>

          <h2 className="text-2xl font-bold text-foreground">{t('auth.register.title')}</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="mt-6 space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="register-name">{t('auth.register.nameLabel')}</Label>
              <Input
                id="register-name"
                autoComplete="name"
                placeholder={t('auth.register.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="register-email">{t('auth.register.emailLabel')}</Label>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder={t('auth.register.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="register-password">{t('auth.register.passwordLabel')}</Label>
              <PasswordInput
                id="register-password"
                autoComplete="new-password"
                placeholder={t('auth.register.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="register-confirm">{t('auth.register.confirmLabel')}</Label>
              <PasswordInput
                id="register-confirm"
                autoComplete="new-password"
                placeholder={t('auth.register.confirmPlaceholder')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="status" aria-live="polite">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={register.isPending}
              aria-busy={register.isPending}
            >
              <UserPlus className="size-4" />
              {register.isPending ? t('auth.register.submitting') : t('auth.register.submit')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.register.haveAccount')}{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('auth.register.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
