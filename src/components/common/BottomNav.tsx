import React from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Ana', icon: '⌂' },
  { path: '/araclar', label: 'Araçlar', icon: '◇' },
  { path: '/kredi-kartlari', label: 'Kartlar', icon: '💳' },
  { path: '/randevular', label: 'Randevular', icon: '📅' },
  { path: '/bildirimler', label: 'Bildirimler', icon: '🔔' },
  { path: '/islemler', label: 'Hareketler', icon: '↕' },
  { path: '/profil', label: 'Profil', icon: '◉' },
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
            color: isActive ? '#E9D5FF' : '#6F748A',
            background: isActive ? 'rgba(168,85,247,.12)' : 'transparent',
            boxShadow: isActive ? 'inset 0 0 22px rgba(168,85,247,.08)' : 'none',
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
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 2,
    padding: 4,
    borderRadius: 20,
    background: 'rgba(8,9,21,.9)',
    backdropFilter: 'blur(22px)',
    WebkitBackdropFilter: 'blur(22px)',
    border: '1px solid rgba(168,85,247,.22)',
    boxShadow: '0 18px 50px rgba(0,0,0,.48)',
    zIndex: 50,
  },
  tab: {
    minHeight: 50,
    borderRadius: 14,
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    fontWeight: 800,
  },
  icon: { fontSize: 19, lineHeight: 1 },
  label: { fontSize: 8 },
};
