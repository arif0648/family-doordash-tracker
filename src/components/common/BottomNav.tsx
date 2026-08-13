import React from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Ana', icon: '⌂' },
  { path: '/kredi-kartlari', label: 'Kartlar', icon: '💳' },
  { path: '/raporlar', label: 'Raporlar', icon: '�' },
  { path: '/profil', label: 'Profil', icon: '◉' },
];

export function BottomNav() {
  return (
    <nav style={S.nav}>
      {tabs.map((t, i) => (
        <React.Fragment key={t.path}>
          {i === 2 ? (
            <NavLink to="/kazanc" style={S.center}>
              <span>＋</span>
            </NavLink>
          ) : null}
          <NavLink
            to={t.path}
            end={t.path === '/'}
            style={({ isActive }) => ({
              ...S.tab,
              color: isActive ? '#38BDF8' : '#8A90A6',
              background: isActive ? 'rgba(56,189,248,.12)' : 'transparent',
              boxShadow: isActive ? 'inset 0 0 22px rgba(56,189,248,.08)' : 'none',
            })}
          >
            <span style={S.icon}>{t.icon}</span>
            <span style={S.label}>{t.label}</span>
          </NavLink>
        </React.Fragment>
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
    gridTemplateColumns: '1fr 1fr 64px 1fr 1fr',
    gap: 4,
    padding: 6,
    borderRadius: 24,
    background: 'rgba(20,25,38,.94)',
    border: '1px solid rgba(255,255,255,.07)',
    boxShadow: '0 18px 50px rgba(0,0,0,.48)',
    zIndex: 50,
  },
  tab: {
    minHeight: 50,
    borderRadius: 16,
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    fontWeight: 800,
  },
  center: {
    display: 'grid',
    placeItems: 'center',
    width: 54,
    height: 54,
    borderRadius: 999,
    background: '#38BDF8',
    color: '#0A0E1A',
    fontSize: 28,
    fontWeight: 900,
    textDecoration: 'none',
    alignSelf: 'center',
    justifySelf: 'center',
    boxShadow: '0 8px 24px rgba(56,189,248,.35)',
  },
  icon: { fontSize: 18, lineHeight: 1 },
  label: { fontSize: 9 },
};
