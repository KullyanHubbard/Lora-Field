import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  CloudSun,
  Cpu,
  Droplets,
  History,
  LayoutDashboard,
  LineChart,
  LogOut,
  Radio,
  Settings,
  Sprout,
} from 'lucide-react';
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
import { useAuth } from '@/features/auth/AuthContext';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  // Context-aware: di dalam /farms/:id/* (kecuali /farms/add) → mode farm-context.
  const farmMatch = pathname.match(/^\/farms\/([^/]+)/);
  const farmId = farmMatch && farmMatch[1] !== 'add' ? farmMatch[1] : null;

  const selectorNav: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/farms', label: 'Kebun Saya', icon: Sprout },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const farmNav: NavItem[] = farmId
    ? [
        { to: `/farms/${farmId}/monitoring`, label: 'Monitoring', icon: LineChart },
        { to: `/farms/${farmId}/irrigation`, label: 'Irigasi', icon: Droplets },
        { to: `/farms/${farmId}/gateway`, label: 'Gateway', icon: Radio },
        { to: `/farms/${farmId}/nodes`, label: 'Node Sensor', icon: Cpu },
        { to: `/farms/${farmId}/weather`, label: 'Cuaca', icon: CloudSun },
        { to: `/farms/${farmId}/logs`, label: 'Riwayat', icon: History },
      ]
    : [];

  const title = farmId ? 'Detail Kebun' : 'Dashboard';

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <Sprout className="size-5 text-primary" />
            <span className="text-base font-semibold text-foreground">LoraField</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {farmId ? (
            <>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <Link to="/dashboard">
                          <ArrowLeft />
                          <span>Kembali ke Dashboard</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupLabel>Kebun</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {farmNav.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton asChild isActive={pathname === item.to}>
                            <Link to={item.to}>
                              <Icon />
                              <span>{item.label}</span>
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
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {selectorNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={pathname === item.to}>
                          <Link to={item.to}>
                            <Icon />
                            <span>{item.label}</span>
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
              {user?.name ?? user?.email ?? 'Pengguna'}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              Logout
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
