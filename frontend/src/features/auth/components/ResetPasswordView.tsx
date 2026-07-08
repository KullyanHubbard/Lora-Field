import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthErrorMessage } from '@/features/auth/components/AuthErrorMessage';
import { AuthSplitLayout } from '@/features/auth/components/AuthSplitLayout';
import type { ResetPasswordViewModel } from '@/features/auth/useResetPasswordViewModel';

export function ResetPasswordView({ viewModel }: { viewModel: ResetPasswordViewModel }) {
  const { t } = useTranslation();

  return (
    <AuthSplitLayout
      backToHomeLabel={t('auth.resetPassword.backToHome')}
      headline={t('auth.resetPassword.headline')}
      copyright={t('auth.resetPassword.copyright')}
      privacyPolicyLabel={t('auth.resetPassword.privacyPolicy')}
    >
      <h2 className="text-2xl font-bold text-foreground">{t('auth.resetPassword.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{viewModel.description}</p>

      <div className="mt-6">
        {viewModel.step === 'email' && <ResetEmailForm viewModel={viewModel} />}
        {viewModel.step === 'otp' && <ResetOtpForm viewModel={viewModel} />}
        {viewModel.step === 'password' && <ResetNewPasswordForm viewModel={viewModel} />}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.resetPassword.backToLoginText')}{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.resetPassword.loginLink')}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}

function ResetEmailForm({ viewModel }: { viewModel: ResetPasswordViewModel }) {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        viewModel.submitEmail();
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
          value={viewModel.email}
          onChange={(event) => viewModel.setEmail(event.target.value)}
          required
        />
      </div>
      <AuthErrorMessage message={viewModel.error} />
      <Button type="submit" className="w-full" disabled={viewModel.isSendingCode}>
        {t('auth.resetPassword.sendCode')}
      </Button>
    </form>
  );
}

function ResetOtpForm({ viewModel }: { viewModel: ResetPasswordViewModel }) {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        viewModel.submitOtp();
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
          value={viewModel.otp}
          onChange={(event) => viewModel.setOtp(event.target.value)}
          required
        />
      </div>
      <AuthErrorMessage message={viewModel.error} />
      <Button type="submit" className="w-full" disabled={viewModel.isVerifyingCode}>
        {t('auth.resetPassword.verifyCode')}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        onClick={viewModel.changeEmail}
      >
        {t('auth.resetPassword.changeEmail')}
      </button>
    </form>
  );
}

function ResetNewPasswordForm({ viewModel }: { viewModel: ResetPasswordViewModel }) {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        viewModel.submitPassword();
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="reset-password">{t('auth.resetPassword.newPasswordLabel')}</Label>
        <PasswordInput
          id="reset-password"
          autoComplete="new-password"
          placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
          value={viewModel.password}
          onChange={(event) => viewModel.setPassword(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm">{t('auth.resetPassword.confirmLabel')}</Label>
        <PasswordInput
          id="reset-confirm"
          autoComplete="new-password"
          placeholder={t('auth.resetPassword.confirmPlaceholder')}
          value={viewModel.confirm}
          onChange={(event) => viewModel.setConfirm(event.target.value)}
          required
        />
      </div>
      <AuthErrorMessage message={viewModel.error} />
      <Button type="submit" className="w-full" disabled={viewModel.isUpdatingPassword}>
        {t('auth.resetPassword.updatePassword')}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        onClick={viewModel.changeCode}
      >
        {t('auth.resetPassword.changeCode')}
      </button>
    </form>
  );
}
