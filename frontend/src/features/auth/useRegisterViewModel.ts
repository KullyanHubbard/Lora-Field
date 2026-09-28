import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRegister, useVerifyRegistration } from './queries';
import {
  isPasswordTooShort,
  isValidOtp,
  MIN_PASSWORD_LENGTH,
  OTP_LENGTH,
  isValidEmail,
} from '@/features/auth/validation';

type RegisterStep = 'form' | 'code';

export interface RegisterViewModel {
  step: RegisterStep;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirm: string;
  setConfirm: (value: string) => void;
  code: string;
  setCode: (value: string) => void;
  error: string;
  isSubmitting: boolean;
  isVerifying: boolean;
  submit: () => void;
  submitCode: () => void;
  resendCode: () => void;
  editData: () => void;
}

export function useRegisterViewModel(): RegisterViewModel {
  const register = useRegister();
  const verify = useVerifyRegistration();
  const { t } = useTranslation();

  const [step, setStep] = useState<RegisterStep>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const payload = () => ({ name: name.trim(), email: email.trim(), password });

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
      setError(t('auth.register.errorPasswordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.register.errorPasswordMismatch'));
      return;
    }

    setError('');
    register.mutate(payload(), {
      onSuccess: () => {
        setCode('');
        setStep('code');
      },
    });
  };

  const submitCode = () => {
    const token = code.trim();
    if (!isValidOtp(token)) {
      setError(t('auth.register.errorCodeInvalid', { digits: OTP_LENGTH }));
      return;
    }

    setError('');
    verify.mutate({ ...payload(), token });
  };

  // Daftar ulang dengan data yang sama: backend mengirim kode baru ke email yang belum verifikasi.
  const resendCode = () => {
    setError('');
    register.mutate(payload(), {
      onSuccess: () => {
        setCode('');
        toast.success(t('auth.toast.registerCodeResent'));
      },
    });
  };

  const editData = () => {
    setError('');
    setStep('form');
  };

  return {
    step,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    confirm,
    setConfirm,
    code,
    setCode,
    error,
    isSubmitting: register.isPending,
    isVerifying: verify.isPending,
    submit,
    submitCode,
    resendCode,
    editData,
  };
}
