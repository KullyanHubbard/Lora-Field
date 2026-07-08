import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from './auth-context';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export function useRegister() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (payload: RegisterPayload) =>
      api.register(payload.name, payload.email, payload.password),
    onSuccess: (_data, variables) => {
      // Register tidak mengembalikan token → tidak auto-login. Prefill email
      // untuk LoginPage lalu arahkan ke /login (perilaku lama).
      try {
        sessionStorage.setItem('lf_prefill_email', variables.email);
      } catch {
        // sessionStorage tidak tersedia di sebagian konteks
      }
      toast.success('Akun berhasil dibuat. Silakan masuk.');
      navigate('/login', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal membuat akun.');
    },
  });
}

// --- Lupa password (OTP 2 tahap): forgot -> verify -> reset ---

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.forgotPassword(email),
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal mengirim kode reset.');
    },
  });
}

export function useVerifyResetCode() {
  return useMutation({
    mutationFn: (token: string) => api.verifyResetCode(token),
    onError: (error: Error) => {
      toast.error(error.message || 'Kode reset tidak valid.');
    },
  });
}

export function useResetPassword() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (vars: { token: string; newPassword: string }) =>
      api.resetPassword(vars.token, vars.newPassword),
    onSuccess: () => {
      toast.success('Password berhasil diperbarui. Silakan masuk.');
      navigate('/login', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal memperbarui password.');
    },
  });
}

// --- Profil: update nomor HP (PATCH /api/auth/profile, JWT) ---

export function useUpdateProfile() {
  const { updateUser } = useAuth();
  return useMutation({
    mutationFn: (phone: string) => api.updateProfile(phone),
    onSuccess: (data) => {
      // Sinkronkan user terbaru ke AuthContext + localStorage (topbar ikut update).
      updateUser(data.user);
      toast.success('Nomor handphone diperbarui.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menyimpan nomor handphone.');
    },
  });
}

// --- Ganti password (sudah login, JWT) — beda dari flow lupa password di atas ---

export function useChangePassword() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (vars: { currentPassword: string; newPassword: string }) =>
      api.changePassword(vars.currentPassword, vars.newPassword),
    onSuccess: () => {
      toast.success('Password berhasil diperbarui.');
      navigate('/settings', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal mengganti password.');
    },
  });
}
