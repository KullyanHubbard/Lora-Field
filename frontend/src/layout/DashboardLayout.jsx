import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';

/**
 * Layout untuk halaman authenticated (sidebar + topbar + main content).
 * Mobile: hamburger toggle sidebar dengan overlay, ESC menutup, dan
 * route change otomatis menutup drawer.
 */
export function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Tutup sidebar saat pindah route (UX standar mobile drawer).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock scroll body kalau sidebar mobile terbuka, biar tidak double-scroll.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  // ESC menutup sidebar.
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') setSidebarOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="ambient-bg">
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
      </div>
      <div
        className={`sidebar-overlay${sidebarOpen ? ' active' : ''}`}
        id="sidebar-overlay"
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <Topbar onMenuToggle={() => setSidebarOpen((open) => !open)} />
        <div className="page-content">{children}</div>
      </main>
    </>
  );
}
