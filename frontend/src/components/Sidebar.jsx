import { NavLink } from 'react-router-dom';
import { useFarmContext } from '../hooks/useFarmContext';

const SELECTOR_NAV = [
  { to: '/dashboard', icon: 'fas fa-map-location-dot', label: 'Kebun Saya', end: true },
  { to: '/settings', icon: 'fas fa-user-gear', label: 'Pengaturan Akun' },
];

function farmNavItems(farmId) {
  return [
    { to: `/farms/${farmId}`, icon: 'fas fa-th-large', label: 'Dashboard', end: true },
    { to: `/farms/${farmId}/monitoring`, icon: 'fas fa-chart-area', label: 'Monitoring' },
    { to: `/farms/${farmId}/irrigation`, icon: 'fas fa-tint', label: 'Irigasi' },
    { to: `/farms/${farmId}/gateway`, icon: 'fas fa-tower-broadcast', label: 'Gateway' },
    { to: `/farms/${farmId}/nodes`, icon: 'fas fa-microchip', label: 'Node Sensor' },
    { to: `/farms/${farmId}/weather`, icon: 'fas fa-cloud-sun', label: 'Cuaca' },
    { to: `/farms/${farmId}/logs`, icon: 'fas fa-list-alt', label: 'Riwayat' },
  ];
}

/**
 * Sidebar yang otomatis switch nav items:
 *   - /farms/:id/*  → farm context (Dashboard, Monitoring, dst.)
 *   - lainnya       → selector context (Kebun Saya, Pengaturan Akun)
 */
export function Sidebar({ open, onClose }) {
  const { farmId, isFarmContext } = useFarmContext();
  const items = isFarmContext ? farmNavItems(farmId) : SELECTOR_NAV;

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar" aria-label="Navigasi utama">
      <div className="sidebar-brand">
        <h2 className="sidebar-brand-title">
          <img src="/static/img/logo.svg" className="brand-logo" alt="" />
          <span className="brand-name">LoraField</span>
        </h2>
      </div>
      <nav className="sidebar-nav" aria-label="Menu aplikasi">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={onClose}
          >
            <i className={item.icon} aria-hidden="true" />
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">LoraField v1.5 Beta &middot; CDP 2026</div>
    </aside>
  );
}
