import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegister } from './queries';
import { isPasswordTooShort, isValidEmail } from '@/features/auth/validation';

export interface RegisterViewModel {
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirm: string;
  setConfirm: (value: string) => void;
  error: string;
  isSubmitting: boolean;
  submit: () => void;
}

export function useRegisterViewModel(): RegisterViewModel {
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
    if (!isValidEmail(trimmedEmail)) {
      setError(t('auth.register.errorEmailInvalid'));
      return;
    }
    if (isPasswordTooShort(password)) {
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

  return {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    confirm,
    setConfirm,
    error,
    isSubmitting: register.isPending,
    submit,
  };
}
