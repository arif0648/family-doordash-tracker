import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { QuickActionsSheet } from './QuickActionsSheet';
import { MenuSheet } from './MenuSheet';

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
        {/* Ana */}
        <NavLink
          to="/"
          end
          style={{
            ...S.tab,
            color: activeFor('/') ? 'var(--accent)' : 'var(--text-secondary)',
            background: activeFor('/') ? 'rgba(56, 189, 248, 0.10)' : 'transparent',
          }}
        >
          <span style={S.icon}>⌂</span>
          <span style={S.label}>Ana</span>
        </NavLink>

        {/* Hareketler */}
        <NavLink
          to="/islemler"
          style={{
            ...S.tab,
            color: activeFor('/islemler') ? 'var(--accent)' : 'var(--text-secondary)',
            background: activeFor('/islemler') ? 'rgba(56, 189, 248, 0.10)' : 'transparent',
          }}
        >
          <span style={S.icon}>⇄</span>
          <span style={S.label}>Hareketler</span>
        </NavLink>

        {/* + button (3rd column, centered) */}
        <button
          type="button"
          style={{ ...S.action, background: 'var(--positive)' }}
          onClick={() => setQuickOpen(true)}
          aria-label="Yeni işlem"
        >
          <span style={{ ...S.actionIcon, color: '#062C1B' }}>＋</span>
        </button>

        {/* Kartlar */}
        <NavLink
          to="/kredi-kartlari"
          style={{
            ...S.tab,
            color: activeFor('/kredi-kartlari') ? 'var(--accent)' : 'var(--text-secondary)',
            background: activeFor('/kredi-kartlari') ? 'rgba(56, 189, 248, 0.10)' : 'transparent',
          }}
        >
          <span style={S.icon}>💳</span>
          <span style={S.label}>Kartlar</span>
        </NavLink>

        {/* Menü */}
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
    gridTemplateColumns: 'repeat(5, 1fr)',
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
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: 'none',
    display: 'grid',
    placeItems: 'center',
    transition: 'transform 120ms ease, background 120ms ease',
    minWidth: 56,
    minHeight: 56,
  },
  actionIcon: { fontSize: 26, fontWeight: 900, lineHeight: 1 },
};
