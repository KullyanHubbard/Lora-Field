import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth-context';

interface AuthLocationState {
  from?: {
    pathname?: string;
  };
}

export interface LoginViewModel {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  submitting: boolean;
  error: string;
  submit: () => Promise<void>;
}

function readPrefillEmail(): string {
  try {
    const prefill = sessionStorage.getItem('lf_prefill_email');
    if (prefill) {
      sessionStorage.removeItem('lf_prefill_email');
      return prefill;
    }
  } catch {
    return '';
  }
  return '';
}

function getRedirectPath(state: unknown): string {
  return (state as AuthLocationState | null)?.from?.pathname ?? '/select-farms';
}

export function useLoginViewModel(): LoginViewModel {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState(readPrefillEmail);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    // Password dikirim apa adanya (tidak di-trim), sama seperti saat register.
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError(t('auth.login.errorRequired'));
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await login(trimmedEmail, password);
      navigate(getRedirectPath(location.state), { replace: true });
    } catch (err) {
      setError((err as Error).message || t('auth.login.errorFallback'));
      setSubmitting(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    submitting,
    error,
    submit,
  };
}
