import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useForgotPassword, useResetPassword, useVerifyResetCode } from './queries';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'email' | 'otp' | 'password';

export default function ResetPasswordPage() {
  const forgot = useForgotPassword();
  const verify = useVerifyResetCode();
  const reset = useResetPassword();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifiedToken, setVerifiedToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submitEmail = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Email belum valid.');
      return;
    }
    setError('');
    forgot.mutate(trimmed, { onSuccess: () => setStep('otp') });
  };

  const submitOtp = () => {
    const tokenTrim = otp.trim();
    if (!/^\d{6}$/.test(tokenTrim)) {
      setError('Kode reset harus 6 digit angka.');
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
      setError('Password baru minimal 6 karakter.');
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi password belum sama.');
      return;
    }
    setError('');
    reset.mutate({ token: verifiedToken, newPassword: password });
  };

  const description =
    step === 'email'
      ? 'Masukkan email akun Anda untuk menerima kode reset 6 digit.'
      : step === 'otp'
        ? `Masukkan kode 6 digit yang dikirim ke ${email}.`
        : 'Buat password baru untuk akun Anda.';

  return (
    <div className="flex min-h-svh">
      {/* Panel kiri — branding */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 flex-col bg-gradient-to-br from-primary to-primary/80 p-10">
        {/* Dekorasi: pola dot-grid */}
        <div className="pointer-events-none absolute inset-0 text-foreground/50 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />
        {/* Dekorasi: glow lembut di belakang headline */}
        <div className="pointer-events-none absolute left-1/4 top-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/30 blur-3xl" />

        <Link
          to="/"
          aria-label="Kembali ke beranda LoraField"
          className="relative z-10 -mx-2 flex self-start items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-primary-foreground/10 active:bg-primary-foreground/20"
        >
          <span className="text-2xl font-semibold text-primary-foreground">LoraField</span>
        </Link>

        <div className="relative z-10 flex flex-1 flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <h1 className="text-6xl font-bold leading-tight tracking-tight text-primary-foreground">
              Pulihkan akses ke kebun Anda.
            </h1>
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-primary-foreground/70">
          <span>© 2026 LoraField</span>
          <a href="#" className="transition-colors hover:text-primary-foreground">
            Kebijakan Privasi
          </a>
        </div>
      </div>

      {/* Panel kanan — form */}
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Logo hanya tampil di mobile */}
          <Link
            to="/"
            aria-label="Kembali ke beranda LoraField"
            className="-mx-2 mb-8 flex self-start items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-accent active:bg-accent/80 lg:hidden"
          >
            <span className="text-lg font-semibold text-foreground">LoraField</span>
          </Link>

          <h2 className="text-2xl font-bold text-foreground">Atur Ulang Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>

          <div className="mt-6">
            {step === 'email' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitEmail();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email Akun</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="status" aria-live="polite">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={forgot.isPending}>
                  Kirim Kode Reset
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitOtp();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="reset-otp">Kode Reset (6 Digit)</Label>
                  <Input
                    id="reset-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="Contoh: 123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="status" aria-live="polite">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={verify.isPending}>
                  Verifikasi Kode
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setError('');
                    setStep('email');
                  }}
                >
                  Ganti email
                </button>
              </form>
            )}

            {step === 'password' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitPassword();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="reset-password">Password Baru</Label>
                  <PasswordInput
                    id="reset-password"
                    autoComplete="new-password"
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-confirm">Ulangi Password Baru</Label>
                  <PasswordInput
                    id="reset-confirm"
                    autoComplete="new-password"
                    placeholder="Ulangi password baru"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="status" aria-live="polite">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={reset.isPending}>
                  Perbarui Password
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setError('');
                    setPassword('');
                    setConfirm('');
                    setStep('otp');
                  }}
                >
                  Ganti kode
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Kembali ke{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
