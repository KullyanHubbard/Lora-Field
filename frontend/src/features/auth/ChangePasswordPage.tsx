import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChangePassword } from './queries';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function ChangePasswordPage() {
  const changePassword = useChangePassword();
  const { t } = useTranslation();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!currentPw) {
      setError(t('auth.changePassword.errorCurrentRequired'));
      return;
    }
    if (newPw.length < 6) {
      setError(t('auth.changePassword.errorNewTooShort'));
      return;
    }
    if (newPw === currentPw) {
      setError(t('auth.changePassword.errorSamePassword'));
      return;
    }
    if (newPw !== confirmPw) {
      setError(t('auth.changePassword.errorMismatch'));
      return;
    }
    setError('');
    changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-base">{t('auth.changePassword.title')}</CardTitle>
        <CardDescription>{t('auth.changePassword.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="current-password">{t('auth.changePassword.currentLabel')}</Label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              placeholder={t('auth.changePassword.currentPlaceholder')}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">{t('auth.changePassword.newLabel')}</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              placeholder={t('auth.changePassword.newPlaceholder')}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">{t('auth.changePassword.confirmLabel')}</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              placeholder={t('auth.changePassword.confirmPlaceholder')}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="status" aria-live="polite">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={changePassword.isPending}>
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
