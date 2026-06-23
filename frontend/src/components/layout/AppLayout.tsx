import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  CloudSun,
  Cpu,
  Droplets,
  History,
  Home,
  LayoutDashboard,
  LineChart,
  LogOut,
  Radio,
  Settings,
  Sprout,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/layout/BrandMark';
import { useAuth } from '@/features/auth/AuthContext';
import { useFarmSummary } from '@/features/farms/queries';

type NavItem = {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  // Context-aware: di dalam /farms/:id/* (kecuali /farms/add) → mode farm-context.
  const farmMatch = pathname.match(/^\/farms\/([^/]+)/);
  const farmId = farmMatch && farmMatch[1] !== 'add' ? farmMatch[1] : null;
  const { data: farmSummary } = useFarmSummary(farmId ?? '');
  const farmName = farmSummary?.farm.name ?? t('layout.fallbackFarm');

  const selectorNav: NavItem[] = [
    { to: '/dashboard', labelKey: 'layout.nav.dashboard', icon: LayoutDashboard },
    { to: '/farms', labelKey: 'layout.nav.myFarms', icon: Sprout },
    { to: '/settings', labelKey: 'layout.nav.settings', icon: Settings },
  ];

  const farmNav: NavItem[] = farmId
    ? [
        { to: `/farms/${farmId}`, labelKey: 'layout.nav.farmSummary', icon: Home },
        { to: `/farms/${farmId}/monitoring`, labelKey: 'layout.nav.monitoring', icon: LineChart },
        { to: `/farms/${farmId}/irrigation`, labelKey: 'layout.nav.irrigation', icon: Droplets },
        { to: `/farms/${farmId}/gateway`, labelKey: 'layout.nav.gateway', icon: Radio },
        { to: `/farms/${farmId}/nodes`, labelKey: 'layout.nav.sensorNode', icon: Cpu },
        { to: `/farms/${farmId}/weather`, labelKey: 'layout.nav.weather', icon: CloudSun },
        { to: `/farms/${farmId}/logs`, labelKey: 'layout.nav.history', icon: History },
      ]
    : [];

  const title = farmId ? t('layout.farmContext') : t('layout.nav.dashboard');

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <BrandMark className="px-2 py-1" />
        </SidebarHeader>

        <SidebarContent>
          {farmId ? (
            <>
              <SidebarGroup>
                <SidebarGroupContent>
                  {/* Back link — sengaja bukan SidebarMenuButton, bobot visual rendah
                      supaya tidak bersaing dengan judul nama kebun di bawahnya. */}
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>{t('layout.backToDashboard')}</span>
                  </Link>
                  {/* Nama kebun = judul halaman farm-context, dipisah border bawah dari menu. */}
                  <div className="mt-1 truncate border-b border-border px-2 pb-3 text-base font-semibold text-foreground">
                    {farmName}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {farmNav.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton asChild isActive={pathname === item.to}>
                            <Link to={item.to}>
                              <Icon />
                              <span>{t(item.labelKey)}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          ) : (
            <SidebarGroup>
              <SidebarGroupLabel>{t('layout.menu')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {selectorNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={pathname === item.to}>
                          <Link to={item.to}>
                            <Icon />
                            <span>{t(item.labelKey)}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b border-border bg-background px-4">
          <SidebarTrigger />
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.name ?? user?.email ?? t('layout.fallbackUser')}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              {t('layout.logout')}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
