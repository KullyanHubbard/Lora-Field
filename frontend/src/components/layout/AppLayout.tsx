import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  CloudSun,
  Cpu,
  Droplets,
  HelpCircle,
  History,
  Home,
  LayoutDashboard,
  LineChart,
  LogOut,
  Plus,
  Radio,
  Settings,
  Sprout,
  UserCog,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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

  const selectorTitles: Record<string, string> = {
    '/dashboard': t('layout.nav.dashboard'),
    '/farms': t('layout.nav.myFarms'),
    '/farms/add': t('farms.addForm.pageTitle'),
    '/settings': t('layout.nav.settings'),
    '/change-password': t('layout.nav.changePassword'),
  };
  // Judul header farm-context ikut halaman aktif: ambil label dari farmNav,
  // termasuk route ringkasan (/farms/:id) → "Ringkasan Kebun".
  const farmActiveNav = farmId ? farmNav.find((item) => item.to === pathname) : undefined;
  const farmTitle = farmActiveNav ? t(farmActiveNav.labelKey) : t('layout.farmContext');
  const title = farmId ? farmTitle : (selectorTitles[pathname] ?? t('layout.nav.dashboard'));

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <BrandMark className="px-2 py-1" />
        </SidebarHeader>

        <SidebarContent>
          {farmId ? (
            <>
              <SidebarGroup className="pb-1">
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
                  {/* Nama kebun = judul halaman farm-context. */}
                  <div className="mt-1 truncate px-2 pb-1 text-base font-semibold text-foreground">
                    {farmName}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>

              {/* Separator identik dengan mode selector (Home / Menu Navigasi). */}
              <div className="mx-4 my-1 h-px bg-sidebar-border" />

              <SidebarGroup className="pt-1">
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1.5 px-3">
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
            <>
              {/* HOME — link ke landing page */}
              <SidebarGroup className="pb-1">
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1.5 px-3">
                    <SidebarMenuItem>
                      {/* Link keluar ke landing publik; AppLayout tak pernah aktif di "/",
                          jadi tidak ada state isActive. */}
                      <SidebarMenuButton asChild>
                        <Link to="/">
                          <Home />
                          <span>{t('layout.nav.home')}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <div className="mx-4 my-1 h-px bg-sidebar-border" />

              {/* Menu Navigasi */}
              <SidebarGroup className="pt-1">
                <SidebarGroupLabel>{t('layout.menuNav')}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1.5 px-3">
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

                    {/* Registrasi Kebun */}
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === '/farms/add'}>
                        <Link to="/farms/add">
                          <Plus />
                          <span>{t('layout.nav.registerFarm')}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>

        <SidebarFooter>
          <div className="mx-4 h-px bg-sidebar-border" />
          <SidebarMenu className="gap-1.5 px-3 py-2">
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/settings'}>
                <Link to="/settings">
                  <Settings />
                  <span>{t('layout.nav.settings')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton disabled>
                <HelpCircle />
                <span>{t('layout.nav.helpCenter')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={logout}>
                <UserCog />
                <span>{t('layout.nav.switchAccount')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b border-border bg-background px-4">
          <SidebarTrigger />
          <h1 className="text-xl font-semibold text-primary">{title}</h1>
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
