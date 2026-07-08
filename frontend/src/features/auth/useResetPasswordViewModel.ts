import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForgotPassword, useResetPassword, useVerifyResetCode } from './queries';

export type ResetPasswordStep = 'email' | 'otp' | 'password';

export interface ResetPasswordViewModel {
  step: ResetPasswordStep;
  email: string;
  setEmail: (value: string) => void;
  otp: string;
  setOtp: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirm: string;
  setConfirm: (value: string) => void;
  error: string;
  description: string;
  isSendingCode: boolean;
  isVerifyingCode: boolean;
  isUpdatingPassword: boolean;
  submitEmail: () => void;
  submitOtp: () => void;
  submitPassword: () => void;
  changeEmail: () => void;
  changeCode: () => void;
}

export function useResetPasswordViewModel(): ResetPasswordViewModel {
  const forgot = useForgotPassword();
  const verify = useVerifyResetCode();
  const reset = useResetPassword();
  const { t } = useTranslation();

  const [step, setStep] = useState<ResetPasswordStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifiedToken, setVerifiedToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submitEmail = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError(t('auth.resetPassword.errorEmailInvalid'));
      return;
    }

    setError('');
    forgot.mutate(trimmed, { onSuccess: () => setStep('otp') });
  };

  const submitOtp = () => {
    const tokenTrim = otp.trim();
    if (!/^\d{6}$/.test(tokenTrim)) {
      setError(t('auth.resetPassword.errorOtpInvalid'));
      return;
    }

    setError('');
    verify.mutate(tokenTrim, {
      onSuccess: () => {
        setVerifiedToken(tokenTrim);
        setStep('password');
      },
    });
  };

  const submitPassword = () => {
    if (password.length < 6) {
      setError(t('auth.resetPassword.errorPasswordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.resetPassword.errorPasswordMismatch'));
      return;
    }

    setError('');
    reset.mutate({ token: verifiedToken, newPassword: password });
  };

  const changeEmail = () => {
    setError('');
    setStep('email');
  };

  const changeCode = () => {
    setError('');
    setPassword('');
    setConfirm('');
    setStep('otp');
  };

  const description =
    step === 'email'
      ? t('auth.resetPassword.descEmail')
      : step === 'otp'
        ? t('auth.resetPassword.descOtp', { email })
        : t('auth.resetPassword.descPassword');

  return {
    step,
    email,
    setEmail,
    otp,
    setOtp,
    password,
    setPassword,
    confirm,
    setConfirm,
    error,
    description,
    isSendingCode: forgot.isPending,
    isVerifyingCode: verify.isPending,
    isUpdatingPassword: reset.isPending,
    submitEmail,
    submitOtp,
    submitPassword,
    changeEmail,
    changeCode,
  };
}
