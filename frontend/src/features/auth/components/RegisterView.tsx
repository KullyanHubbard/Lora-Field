import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthErrorMessage } from '@/features/auth/components/AuthErrorMessage';
import { AuthSplitLayout } from '@/features/auth/components/AuthSplitLayout';
import type { RegisterViewModel } from '@/features/auth/useRegisterViewModel';
import { MIN_PASSWORD_LENGTH, OTP_LENGTH } from '@/features/auth/validation';

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
      {viewModel.step === 'code' && (
        <p className="mt-1 text-sm text-muted-foreground">
          {t('auth.register.descCode', { email: viewModel.email.trim(), digits: OTP_LENGTH })}
        </p>
      )}

      <div className="mt-6">
        {viewModel.step === 'form' ? (
          <RegisterForm viewModel={viewModel} />
        ) : (
          <RegisterCodeForm viewModel={viewModel} />
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.register.loginLink')}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}

function RegisterForm({ viewModel }: { viewModel: RegisterViewModel }) {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        viewModel.submit();
      }}
      className="space-y-4"
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
          placeholder={t('auth.register.passwordPlaceholder', { min: MIN_PASSWORD_LENGTH })}
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
  );
}

function RegisterCodeForm({ viewModel }: { viewModel: RegisterViewModel }) {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        viewModel.submitCode();
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="register-code">
          {t('auth.register.codeLabel', { digits: OTP_LENGTH })}
        </Label>
        <Input
          id="register-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`[0-9]{${OTP_LENGTH}}`}
          maxLength={OTP_LENGTH}
          placeholder={t('auth.register.codePlaceholder')}
          value={viewModel.code}
          onChange={(event) => viewModel.setCode(event.target.value)}
          required
        />
      </div>
      <AuthErrorMessage message={viewModel.error} />
      <Button type="submit" className="w-full" disabled={viewModel.isVerifying}>
        {t('auth.register.verifyCode')}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        onClick={viewModel.resendCode}
        disabled={viewModel.isSubmitting}
      >
        {t('auth.register.resendCode')}
      </button>
      <button
        type="button"
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        onClick={viewModel.editData}
      >
        {t('auth.register.editData')}
      </button>
    </form>
  );
}
