import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useForgotPassword, useResetPassword, useVerifyResetCode } from './queries';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'email' | 'otp' | 'password';

export default function ResetPasswordPage() {
  const forgot = useForgotPassword();
  const verify = useVerifyResetCode();
  const reset = useResetPassword();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifiedToken, setVerifiedToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submitEmail = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError(t('auth.resetPassword.errorEmailInvalid'));
      return;
    }
    setError('');
    forgot.mutate(trimmed, { onSuccess: () => setStep('otp') });
  };

  const submitOtp = () => {
    const tokenTrim = otp.trim();
    if (!/^\d{6}$/.test(tokenTrim)) {
      setError(t('auth.resetPassword.errorOtpInvalid'));
      return;
    }
    setError('');
    verify.mutate(tokenTrim, {
      onSuccess: () => {
        setVerifiedToken(tokenTrim);
        setStep('password');
      },
    });
  };

  const submitPassword = () => {
    if (password.length < 6) {
      setError(t('auth.resetPassword.errorPasswordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.resetPassword.errorPasswordMismatch'));
      return;
    }
    setError('');
    reset.mutate({ token: verifiedToken, newPassword: password });
  };

  const description =
    step === 'email'
      ? t('auth.resetPassword.descEmail')
      : step === 'otp'
        ? t('auth.resetPassword.descOtp', { email })
        : t('auth.resetPassword.descPassword');

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
          aria-label={t('auth.resetPassword.backToHome')}
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
              {t('auth.resetPassword.headline')}
            </h1>
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-primary-foreground/70">
          <span>{t('auth.resetPassword.copyright')}</span>
          <a href="#" className="transition-colors hover:text-primary-foreground">
            {t('auth.resetPassword.privacyPolicy')}
          </a>
        </div>
      </div>

      {/* Panel kanan — form */}
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Logo hanya tampil di mobile */}
          <Link
            to="/"
            aria-label={t('auth.resetPassword.backToHome')}
            className="-mx-2 mb-8 flex self-start items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-accent active:bg-accent/80 lg:hidden"
          >
            <span className="text-lg font-semibold text-foreground">LoraField</span>
          </Link>

          <h2 className="text-2xl font-bold text-foreground">{t('auth.resetPassword.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>

          <div className="mt-6">
            {step === 'email' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitEmail();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">{t('auth.resetPassword.emailLabel')}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('auth.resetPassword.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="status" aria-live="polite">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={forgot.isPending}>
                  {t('auth.resetPassword.sendCode')}
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitOtp();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="reset-otp">{t('auth.resetPassword.otpLabel')}</Label>
                  <Input
                    id="reset-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder={t('auth.resetPassword.otpPlaceholder')}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="status" aria-live="polite">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={verify.isPending}>
                  {t('auth.resetPassword.verifyCode')}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setError('');
                    setStep('email');
                  }}
                >
                  {t('auth.resetPassword.changeEmail')}
                </button>
              </form>
            )}

            {step === 'password' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitPassword();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="reset-password">{t('auth.resetPassword.newPasswordLabel')}</Label>
                  <PasswordInput
                    id="reset-password"
                    autoComplete="new-password"
                    placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-confirm">{t('auth.resetPassword.confirmLabel')}</Label>
                  <PasswordInput
                    id="reset-confirm"
                    autoComplete="new-password"
                    placeholder={t('auth.resetPassword.confirmPlaceholder')}
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
                <Button type="submit" className="w-full" disabled={reset.isPending}>
                  {t('auth.resetPassword.updatePassword')}
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setError('');
                    setPassword('');
                    setConfirm('');
                    setStep('otp');
                  }}
                >
                  {t('auth.resetPassword.changeCode')}
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.resetPassword.backToLoginText')}{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('auth.resetPassword.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
