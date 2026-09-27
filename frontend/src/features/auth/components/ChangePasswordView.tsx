import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AuthErrorMessage } from '@/features/auth/components/AuthErrorMessage';
import type { ChangePasswordViewModel } from '@/features/auth/useChangePasswordViewModel';
import { MIN_PASSWORD_LENGTH } from '@/features/auth/validation';

export function ChangePasswordView({ viewModel }: { viewModel: ChangePasswordViewModel }) {
  const { t } = useTranslation();

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-base">{t('auth.changePassword.title')}</CardTitle>
        <CardDescription>{t('auth.changePassword.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            viewModel.submit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="current-password">{t('auth.changePassword.currentLabel')}</Label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              placeholder={t('auth.changePassword.currentPlaceholder')}
              value={viewModel.currentPassword}
              onChange={(event) => viewModel.setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">{t('auth.changePassword.newLabel')}</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              placeholder={t('auth.changePassword.newPlaceholder', { min: MIN_PASSWORD_LENGTH })}
              value={viewModel.newPassword}
              onChange={(event) => viewModel.setNewPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">{t('auth.changePassword.confirmLabel')}</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              placeholder={t('auth.changePassword.confirmPlaceholder')}
              value={viewModel.confirmPassword}
              onChange={(event) => viewModel.setConfirmPassword(event.target.value)}
            />
          </div>

          <AuthErrorMessage message={viewModel.error} />

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={viewModel.isSubmitting}>
              {t('auth.changePassword.submit')}
            </Button>
            <Button asChild variant="outline">
              <Link to="/settings">{t('auth.changePassword.backToSettings')}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
