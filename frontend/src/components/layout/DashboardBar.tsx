import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { BrandMark } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthContext';

// Bar untuk halaman full-bleed tanpa AppLayout (Dashboard, Tambah Kebun). Sengaja
// tipis dan bukan topbar penuh: hanya brand kiri + nama user & logout kanan.
export function DashboardBar() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex w-full items-center gap-3 border-b border-border pb-3 sm:mb-6">
      <BrandMark />
      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {user?.name ?? user?.email ?? t('layout.fallbackUser')}
        </span>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="size-4" />
          {t('layout.logout')}
        </Button>
      </div>
    </div>
  );
}
