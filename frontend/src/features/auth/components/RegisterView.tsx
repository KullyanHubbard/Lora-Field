import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthErrorMessage } from '@/features/auth/components/AuthErrorMessage';
import { AuthSplitLayout } from '@/features/auth/components/AuthSplitLayout';
import type { RegisterViewModel } from '@/features/auth/useRegisterViewModel';

export function RegisterView({ viewModel }: { viewModel: RegisterViewModel }) {
  const { t } = useTranslation();

  return (
    <AuthSplitLayout
      backToHomeLabel={t('auth.register.backToHome')}
      headline={t('auth.register.headline')}
      copyright={t('auth.register.copyright')}
      privacyPolicyLabel={t('auth.register.privacyPolicy')}
    >
      <h2 className="text-2xl font-bold text-foreground">{t('auth.register.title')}</h2>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          viewModel.submit();
        }}
        className="mt-6 space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="register-name">{t('auth.register.nameLabel')}</Label>
          <Input
            id="register-name"
            autoComplete="name"
            placeholder={t('auth.register.namePlaceholder')}
            value={viewModel.name}
            onChange={(event) => viewModel.setName(event.target.value)}
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
            value={viewModel.email}
            onChange={(event) => viewModel.setEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-password">{t('auth.register.passwordLabel')}</Label>
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            placeholder={t('auth.register.passwordPlaceholder')}
            value={viewModel.password}
            onChange={(event) => viewModel.setPassword(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-confirm">{t('auth.register.confirmLabel')}</Label>
          <PasswordInput
            id="register-confirm"
            autoComplete="new-password"
            placeholder={t('auth.register.confirmPlaceholder')}
            value={viewModel.confirm}
            onChange={(event) => viewModel.setConfirm(event.target.value)}
            required
          />
        </div>

        <AuthErrorMessage message={viewModel.error} />

        <Button
          type="submit"
          className="w-full"
          disabled={viewModel.isSubmitting}
          aria-busy={viewModel.isSubmitting}
        >
          <UserPlus className="size-4" />
          {viewModel.isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.register.loginLink')}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
