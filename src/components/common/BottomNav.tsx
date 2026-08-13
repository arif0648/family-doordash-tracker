import React from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Ana Sayfa', icon: '⌂' },
  { path: '/kredi-kartlari', label: 'Krediler', icon: '🏛' },
  { path: '/kazanc', label: 'Kazanç', icon: '＋' },
  { path: '/gider', label: 'Gider', icon: '−' },
  { path: '/araclar', label: 'Araçlar', icon: '🚗' },
  { path: '/profil', label: 'Profil', icon: '⚙' },
];

export function BottomNav() {
  return (
    <nav style={S.nav}>
      {tabs.map((t) => (
        <NavLink
          key={t.path}
          to={t.path}
          end={t.path === '/'}
          style={({ isActive }) => ({
            ...S.tab,
            color: isActive ? '#38BDF8' : '#8A90A6',
            background: isActive ? 'rgba(56,189,248,.12)' : 'transparent',
          })}
        >
          <span style={S.icon}>{t.icon}</span>
          <span style={S.label}>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

const S: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    left: 6,
    right: 6,
    bottom: 'calc(6px + env(safe-area-inset-bottom))',
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 2,
    padding: 6,
    borderRadius: 24,
    background: 'rgba(20,25,38,.94)',
    border: '1px solid rgba(255,255,255,.07)',
    boxShadow: '0 18px 50px rgba(0,0,0,.48)',
    zIndex: 50,
  },
  tab: {
    minHeight: 52,
    borderRadius: 16,
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    fontWeight: 800,
  },
  icon: { fontSize: 20, lineHeight: 1 },
  label: { fontSize: 9 },
};
