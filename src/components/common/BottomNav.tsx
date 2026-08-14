import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { QuickActionsSheet } from './QuickActionsSheet';
import { MenuSheet } from './MenuSheet';

const mainTabs = [
  { path: '/', label: 'Ana', icon: '⌂' },
  { path: '/islemler', label: 'Hareketler', icon: '⇄' },
  { path: '/kredi-kartlari', label: 'Kartlar', icon: '💳' },
];

const menuPaths = ['/araclar', '/sabit-giderler', '/randevular', '/bildirimler', '/raporlar', '/profil'];

export function BottomNav() {
  const [quickOpen, setQuickOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const activeFor = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const menuActive = menuOpen || menuPaths.some((p) => location.pathname.startsWith(p));

  return (
    <>
      <nav style={S.nav}>
        {mainTabs.map((t) => {
          const active = activeFor(t.path);
          return (
            <NavLink
              key={t.path}
              to={t.path}
              end={t.path === '/'}
              style={{
                ...S.tab,
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                background: active ? 'rgba(56, 189, 248, 0.10)' : 'transparent',
              }}
            >
              <span style={S.icon}>{t.icon}</span>
              <span style={S.label}>{t.label}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          style={{ ...S.action, background: 'var(--positive)' }}
          onClick={() => setQuickOpen(true)}
          aria-label="Yeni işlem"
        >
          <span style={{ ...S.actionIcon, color: '#062C1B' }}>＋</span>
        </button>

        <button
          type="button"
          style={{
            ...S.tab,
            color: menuActive ? 'var(--accent)' : 'var(--text-secondary)',
            background: menuActive ? 'rgba(56, 189, 248, 0.10)' : 'transparent',
          }}
          onClick={() => setMenuOpen(true)}
          aria-label="Menü"
        >
          <span style={S.icon}>☰</span>
          <span style={S.label}>Menü</span>
        </button>
      </nav>

      <QuickActionsSheet open={quickOpen} onClose={() => setQuickOpen(false)} />
      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    left: 12,
    right: 12,
    bottom: 'calc(10px + var(--safe-bottom))',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 64px 1fr 1fr',
    gap: 4,
    alignItems: 'center',
    padding: 6,
    borderRadius: 26,
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-nav)',
    zIndex: 50,
    height: 64,
  },
  tab: {
    minHeight: 52,
    borderRadius: 18,
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    fontWeight: 700,
    transition: 'color 120ms ease, background 120ms ease',
  },
  icon: { fontSize: 18, lineHeight: 1 },
  label: { fontSize: 10 },
  action: {
    justifySelf: 'center',
    width: 54,
    height: 54,
    borderRadius: '50%',
    border: 'none',
    display: 'grid',
    placeItems: 'center',
    transition: 'transform 120ms ease, background 120ms ease',
    margin: '0 auto',
  },
  actionIcon: { fontSize: 26, fontWeight: 900, lineHeight: 1 },
};
