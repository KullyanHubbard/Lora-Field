import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  CloudSun,
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
import { useAuth } from '@/features/auth/auth-context';
import { DashboardActiveNodeBadge } from '@/features/dashboard/components/DashboardActiveNodeBadge';
import { useFarmSummary } from '@/features/dashboard/queries';

type NavItem = {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  // Context-aware: di dalam /farms/:id/* (kecuali /addFarm) → mode farm-context.
  const farmMatch = pathname.match(/^\/farms\/([^/]+)/);
  const farmId = farmMatch && farmMatch[1] !== 'add' ? farmMatch[1] : null;
  const { data: farmSummary } = useFarmSummary(farmId ?? '');
  const farmName = farmSummary?.farm.name ?? t('layout.fallbackFarm');

  const selectorNav: NavItem[] = [
    { to: '/select-farms', labelKey: 'layout.nav.selectFarms', icon: LayoutDashboard },
    { to: '/my-farms', labelKey: 'layout.nav.myFarms', icon: Sprout },
  ];

  const farmNav: NavItem[] = farmId
    ? [
        { to: `/farms/${farmId}`, labelKey: 'layout.nav.dashboard', icon: Home },
        { to: `/farms/${farmId}/monitoring`, labelKey: 'layout.nav.monitoring', icon: LineChart },
        { to: `/farms/${farmId}/irrigation`, labelKey: 'layout.nav.irrigation', icon: Droplets },
        { to: `/farms/${farmId}/gateway`, labelKey: 'layout.nav.gateway', icon: Radio },
        { to: `/farms/${farmId}/weather`, labelKey: 'layout.nav.weather', icon: CloudSun },
        { to: `/farms/${farmId}/logs`, labelKey: 'layout.nav.history', icon: History },
      ]
    : [];

  const selectorTitles: Record<string, string> = {
    '/select-farms': t('layout.nav.selectFarms'),
    '/my-farms': t('layout.nav.myFarms'),
    '/addFarm': t('farms.addForm.pageTitle'),
    '/settings': t('layout.nav.settings'),
    '/change-password': t('layout.nav.changePassword'),
  };
  // Judul header farm-context ikut halaman aktif: ambil label dari farmNav,
  // termasuk route dashboard (/farms/:id) → "Dashboard".
  const farmActiveNav = farmId ? farmNav.find((item) => item.to === pathname) : undefined;
  const farmTitle = farmActiveNav ? t(farmActiveNav.labelKey) : t('layout.farmContext');
  const title = farmId ? farmTitle : (selectorTitles[pathname] ?? t('layout.nav.selectFarms'));

  const isDashboardPage = farmId != null && pathname === `/farms/${farmId}`;
  const summaryNodes = farmSummary?.nodes ?? [];

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
                    to="/select-farms"
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>{t('layout.backToSelectFarms')}</span>
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
                      <SidebarMenuButton asChild isActive={pathname === '/addFarm'}>
                        <Link to="/addFarm">
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
        <header className="flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-background px-3 py-2 sm:flex-nowrap sm:px-4">
          <SidebarTrigger className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-primary sm:text-xl">{title}</h1>
          </div>
          {isDashboardPage && <DashboardActiveNodeBadge summaryNodes={summaryNodes} />}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden max-w-32 truncate text-sm text-muted-foreground sm:block lg:max-w-48">
              {user?.name ?? user?.email ?? t('layout.fallbackUser')}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{t('layout.logout')}</span>
            </Button>
          </div>
        </header>

        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
