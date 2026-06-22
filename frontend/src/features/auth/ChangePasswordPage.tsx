import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useChangePassword } from './queries';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function ChangePasswordPage() {
  const changePassword = useChangePassword();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!currentPw) {
      setError('Password saat ini wajib diisi.');
      return;
    }
    if (newPw.length < 6) {
      setError('Password baru minimal 6 karakter.');
      return;
    }
    if (newPw === currentPw) {
      setError('Password baru tidak boleh sama dengan password lama.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('Konfirmasi password belum sama.');
      return;
    }
    setError('');
    changePassword.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Ganti Password</CardTitle>
        <CardDescription>Masukkan password baru untuk akun Anda.</CardDescription>
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
            <Label htmlFor="current-password">Password Saat Ini</Label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              placeholder="Masukkan password saat ini"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password Baru</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              placeholder="Minimal 6 karakter"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Ulangi Password Baru</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              placeholder="Ulangi password baru"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="status" aria-live="polite">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={changePassword.isPending}>
              Simpan Password Baru
            </Button>
            <Button asChild variant="outline">
              <Link to="/settings">Kembali ke Pengaturan</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
