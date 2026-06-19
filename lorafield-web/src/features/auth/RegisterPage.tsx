import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useRegister } from './queries';
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

export default function RegisterPage() {
  const register = useRegister();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Email belum valid.');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (password !== confirm) {
      setError('Ulangi password belum sama.');
      return;
    }
    setError('');
    register.mutate({ name: trimmedName, email: trimmedEmail, password });
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Daftar Akun</CardTitle>
          <CardDescription>Buat akun baru untuk akses dashboard LoraField.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="register-name">Nama Lengkap</Label>
              <Input
                id="register-name"
                autoComplete="name"
                placeholder="Nama lengkap kamu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="register-password">Password</Label>
              <PasswordInput
                id="register-password"
                autoComplete="new-password"
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="register-confirm">Ulangi Password</Label>
              <PasswordInput
                id="register-confirm"
                autoComplete="new-password"
                placeholder="Ulangi password"
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

            <Button
              type="submit"
              className="w-full"
              disabled={register.isPending}
              aria-busy={register.isPending}
            >
              <UserPlus className="size-4" /> Buat Akun
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Sudah punya akun?
          <Link to="/login" className="ml-1 text-primary hover:underline">
            Masuk
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
