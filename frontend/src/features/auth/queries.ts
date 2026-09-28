import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import i18n from '@/i18n/config';
import { getPreferredLanguage, type AppLanguage } from '@/i18n/language';
import { useAuth } from './auth-context';

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

// Daftar 2 tahap: register (kirim kode ke email) -> verify (simpan akun, lalu login).

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) =>
      api.register(payload.name, payload.email, payload.password, getPreferredLanguage()),
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('auth.toast.registerError'));
    },
  });
}

export function useVerifyRegistration() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (vars: RegisterPayload & { token: string }) =>
      api.verifyRegistration(
        vars.name,
        vars.email,
        vars.password,
        vars.token,
        getPreferredLanguage(),
      ),
    onSuccess: (_data, variables) => {
      // Verifikasi tidak mengembalikan token, jadi tidak ada auto-login.
      try {
        sessionStorage.setItem('lf_prefill_email', variables.email);
      } catch {
        // sessionStorage tidak tersedia di sebagian konteks
      }
      toast.success(i18n.t('auth.toast.registerSuccess'));
      navigate('/login', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('auth.toast.verifyRegistrationError'));
    },
  });
}

// Lupa password, OTP 2 tahap: forgot -> verify -> reset.

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.forgotPassword(email),
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('auth.toast.forgotPasswordError'));
    },
  });
}

export function useVerifyResetCode() {
  return useMutation({
    mutationFn: (vars: { email: string; token: string }) =>
      api.verifyResetCode(vars.email, vars.token),
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('auth.toast.verifyResetCodeError'));
    },
  });
}

export function useResetPassword() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (vars: { email: string; token: string; newPassword: string }) =>
      api.resetPassword(vars.email, vars.token, vars.newPassword),
    onSuccess: () => {
      toast.success(i18n.t('auth.toast.resetPasswordSuccess'));
      navigate('/login', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('auth.toast.resetPasswordError'));
    },
  });
}

// Profil: update nomor HP.

export function useUpdateProfile() {
  const { updateUser } = useAuth();
  return useMutation({
    mutationFn: (phone: string) => api.updateProfile(phone, getPreferredLanguage()),
    onSuccess: (data) => {
      updateUser(data.user);
      toast.success(i18n.t('auth.toast.profileSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('auth.toast.profileError'));
    },
  });
}

export function useUpdateLanguage() {
  const { user, updateUser } = useAuth();
  return useMutation({
    mutationFn: (language: AppLanguage) => api.updateLanguage(language),
    onSuccess: ({ language }) => {
      // AuthContext yang menyelaraskan i18n dari user.language.
      if (user) updateUser({ ...user, language });
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('auth.toast.languageError'));
    },
  });
}

// Ganti password saat sudah login. Beda flow dari lupa password di atas.

export function useChangePassword() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (vars: { currentPassword: string; newPassword: string }) =>
      api.changePassword(vars.currentPassword, vars.newPassword),
    onSuccess: () => {
      toast.success(i18n.t('auth.toast.changePasswordSuccess'));
      navigate('/settings', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('auth.toast.changePasswordError'));
    },
  });
}
