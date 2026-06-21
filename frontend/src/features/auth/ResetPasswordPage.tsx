import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useForgotPassword, useResetPassword, useVerifyResetCode } from './queries';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <KeyRound className="size-5" /> Atur Ulang Password
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
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
              {error && <p className="text-sm text-destructive">{error}</p>}
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
              {error && <p className="text-sm text-destructive">{error}</p>}
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
              {error && <p className="text-sm text-destructive">{error}</p>}
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
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Kembali ke
          <Link to="/login" className="ml-1 text-primary hover:underline">
            Masuk
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
