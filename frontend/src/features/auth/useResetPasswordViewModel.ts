import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    if (!isValidEmail(trimmed)) {
      setError(t('auth.resetPassword.errorEmailInvalid'));
      return;
    }

    setError('');
    forgot.mutate(trimmed, { onSuccess: () => setStep('otp') });
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
    changeEmail,
    changeCode,
  };
}
