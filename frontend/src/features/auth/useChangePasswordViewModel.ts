import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChangePassword } from './queries';
import { isPasswordTooShort, MIN_PASSWORD_LENGTH } from '@/features/auth/validation';

export interface ChangePasswordViewModel {
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  error: string;
  isSubmitting: boolean;
  submit: () => void;
}

export function useChangePasswordViewModel(): ChangePasswordViewModel {
  const changePassword = useChangePassword();
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!currentPassword) {
      setError(t('auth.changePassword.errorCurrentRequired'));
      return;
    }
    if (isPasswordTooShort(newPassword)) {
      setError(t('auth.changePassword.errorNewTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (newPassword === currentPassword) {
      setError(t('auth.changePassword.errorSamePassword'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.changePassword.errorMismatch'));
      return;
    }

    setError('');
    changePassword.mutate({ currentPassword, newPassword });
  };

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    isSubmitting: changePassword.isPending,
    submit,
  };
}
