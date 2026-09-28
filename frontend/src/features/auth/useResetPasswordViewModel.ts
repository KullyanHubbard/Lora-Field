import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useForgotPassword, useResetPassword, useVerifyResetCode } from './queries';
import {
  isPasswordTooShort,
  isValidOtp,
  MIN_PASSWORD_LENGTH,
  OTP_LENGTH,
  isValidEmail,
} from '@/features/auth/validation';

type ResetPasswordStep = 'email' | 'otp' | 'password';

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
  enterCode: () => void;
  changeEmail: () => void;
  changeCode: () => void;
}

// Tautan di email reset membawa email di fragmen URL (#email=...), lihat forgot_password di backend.
export function emailFromResetLink(hash: string): string {
  const email = new URLSearchParams(hash.replace(/^#/, '')).get('email')?.trim() ?? '';
  return isValidEmail(email) ? email : '';
}

export function useResetPasswordViewModel(): ResetPasswordViewModel {
  const forgot = useForgotPassword();
  const verify = useVerifyResetCode();
  const reset = useResetPassword();
  const { t } = useTranslation();
  const linkEmail = emailFromResetLink(useLocation().hash);

  const [step, setStep] = useState<ResetPasswordStep>(linkEmail ? 'otp' : 'email');
  const [email, setEmail] = useState(linkEmail);
  const [otp, setOtp] = useState('');
  const [verifiedToken, setVerifiedToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submitEmail = () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError(t('auth.resetPassword.errorEmailInvalid'));
      return;
    }

    setError('');
    forgot.mutate(trimmed, { onSuccess: () => setStep('otp') });
  };

  // Kode di email masih berlaku: buka isian kode tanpa meminta kode baru yang menghanguskannya.
  const enterCode = () => {
    if (!isValidEmail(email.trim())) {
      setError(t('auth.resetPassword.errorEmailInvalid'));
      return;
    }

    setError('');
    setStep('otp');
  };

  const submitOtp = () => {
    const tokenTrim = otp.trim();
    if (!isValidOtp(tokenTrim)) {
      setError(t('auth.resetPassword.errorOtpInvalid', { digits: OTP_LENGTH }));
      return;
    }

    setError('');
    verify.mutate(
      { email: email.trim(), token: tokenTrim },
      {
        onSuccess: () => {
          setVerifiedToken(tokenTrim);
          setStep('password');
        },
      },
    );
  };

  const submitPassword = () => {
    if (isPasswordTooShort(password)) {
      setError(t('auth.resetPassword.errorPasswordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.resetPassword.errorPasswordMismatch'));
      return;
    }

    setError('');
    reset.mutate({ email: email.trim(), token: verifiedToken, newPassword: password });
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
      ? t('auth.resetPassword.descEmail', { digits: OTP_LENGTH })
      : step === 'otp'
        ? t('auth.resetPassword.descOtp', { email, digits: OTP_LENGTH })
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
    enterCode,
    changeEmail,
    changeCode,
  };
}
