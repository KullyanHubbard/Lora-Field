import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Sprout } from 'lucide-react';
import { useAuth } from './AuthContext';
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

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Prefill email dari sessionStorage (di-set halaman register setelah signup).
  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem('lf_prefill_email');
      if (prefill) {
        setEmail(prefill);
        sessionStorage.removeItem('lf_prefill_email');
      }
    } catch {
      // sessionStorage tidak tersedia di sebagian konteks
    }
  }, []);

  const submit = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Email dan password wajib diisi.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(trimmedEmail, trimmedPassword);
      const redirectTo = location.state?.from?.pathname ?? '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Login gagal. Coba lagi.');
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-svh items-center justify-center p-4">
      <Link
        to="/"
        aria-label="Kembali ke beranda LoraField"
        className="absolute left-6 top-6 flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <Sprout className="size-5 text-primary" />
        <span>LoraField</span>
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Masuk Akun</CardTitle>
          <CardDescription>Monitoring kebun LoRa dalam satu akses.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="status" aria-live="polite">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting} aria-busy={submitting}>
              <LogIn className="size-4" /> Masuk
            </Button>

            <div className="text-center text-sm">
              <Link to="/reset-password" className="text-primary hover:underline">
                Lupa Password?
              </Link>
            </div>
          </form>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Belum punya akun?
          <Link to="/register" className="ml-1 text-primary hover:underline">
            Daftar Akun
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
