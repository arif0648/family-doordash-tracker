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
            background: activeFor('/') ? 'rgba(60,200,237,.065)' : 'transparent',
            boxShadow: activeFor('/') ? 'inset 0 -2px 0 rgba(60,200,237,.55)' : 'none',
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
            background: activeFor('/islemler') ? 'rgba(60,200,237,.065)' : 'transparent',
          }}
        >
          <span style={S.icon}>⇄</span>
          <span style={S.label}>Hareketler</span>
        </NavLink>

        {/* + button (3rd column, centered) */}
        <button
          type="button"
          style={S.action}
          onClick={() => setQuickOpen(true)}
          aria-label="Yeni işlem"
        >
          <span style={S.actionIcon}>＋</span>
        </button>

        {/* Kartlar */}
        <NavLink
          to="/kredi-kartlari"
          style={{
            ...S.tab,
            color: activeFor('/kredi-kartlari') ? 'var(--accent)' : 'var(--text-secondary)',
            background: activeFor('/kredi-kartlari') ? 'rgba(60,200,237,.065)' : 'transparent',
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
            background: menuActive ? 'rgba(60,200,237,.065)' : 'transparent',
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
    background: 'rgba(10,16,24,.84)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid var(--border)',
    boxShadow: '0 -10px 36px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.07)',
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
    width: 50,
    height: 50,
    borderRadius: '50%',
    border: '1px solid rgba(53,201,121,.28)',
    background: 'linear-gradient(145deg,rgba(53,201,121,.92),rgba(38,159,96,.92))',
    boxShadow: '0 8px 20px rgba(53,201,121,.16), inset 0 1px 0 rgba(255,255,255,.22)',
    display: 'grid',
    placeItems: 'center',
    transition: 'transform 120ms ease, background 120ms ease',
    minWidth: 50,
    minHeight: 50,
  },
  actionIcon: { color: '#07170f', fontSize: 24, fontWeight: 800, lineHeight: 1 },
};
