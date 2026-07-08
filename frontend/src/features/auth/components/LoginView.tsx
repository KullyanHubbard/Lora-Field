import { Link } from 'react-router-dom';
import { Check, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthErrorMessage } from '@/features/auth/components/AuthErrorMessage';
import { AuthSplitLayout } from '@/features/auth/components/AuthSplitLayout';
import { SocialLoginButtons } from '@/features/auth/components/SocialLoginButtons';
import type { LoginViewModel } from '@/features/auth/useLoginViewModel';

export function LoginView({ viewModel }: { viewModel: LoginViewModel }) {
  const { t } = useTranslation();

  return (
    <AuthSplitLayout
      backToHomeLabel={t('auth.login.backToHome')}
      headline={
        <>
          {t('auth.login.headlineLine1')}
          <br />
          {t('auth.login.headlineLine2')}
        </>
      }
      copyright={t('auth.login.copyright')}
      privacyPolicyLabel={t('auth.login.privacyPolicy')}
    >
      <h2 className="text-2xl font-bold text-foreground">{t('auth.login.title')}</h2>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void viewModel.submit();
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
            value={viewModel.email}
            onChange={(event) => viewModel.setEmail(event.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="login-password">{t('auth.login.passwordLabel')}</Label>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            placeholder={t('auth.login.passwordPlaceholder')}
            value={viewModel.password}
            onChange={(event) => viewModel.setPassword(event.target.value)}
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <span className="relative inline-flex">
              <input
                type="checkbox"
                checked={viewModel.rememberMe}
                onChange={(event) => viewModel.setRememberMe(event.target.checked)}
                className="peer size-4 cursor-pointer appearance-none rounded border border-input bg-transparent transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <Check className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-primary-foreground peer-checked:block" />
            </span>
            {t('auth.login.rememberMe')}
          </label>
          <Link to="/reset-password" className="text-sm text-primary hover:underline">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>

        <AuthErrorMessage message={viewModel.error} />

        <Button
          type="submit"
          className="w-full"
          disabled={viewModel.submitting}
          aria-busy={viewModel.submitting}
        >
          <LogIn className="size-4" />
          {viewModel.submitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>

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

      <SocialLoginButtons />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          {t('auth.login.registerLink')}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
