import React from 'react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { path: '/', label: 'Ana Sayfa', icon: '🏠' },
  { path: '/kazanc', label: 'Kazanç', icon: '💰' },
  { path: '/gider', label: 'Gider', icon: '🧾' },
  { path: '/araclar', label: 'Araçlar', icon: '🚗' },
  { path: '/kredi-kartlari', label: 'Kartlar', icon: '💳' },
  { path: '/profil', label: 'Profil', icon: '👤' },
];

export function BottomNav() {
  return (
    <nav style={styles.nav}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.path === '/'}
          style={({ isActive }) => ({
            ...styles.tab,
            color: isActive ? '#22C55E' : '#64748B',
          })}
        >
          <span style={styles.icon}>{tab.icon}</span>
          <span style={styles.label}>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-around',
    background: '#0F172A',
    borderTop: '1px solid #1E293B',
    paddingBottom: 'env(safe-area-inset-bottom, 8px)',
    paddingTop: 8,
    zIndex: 50,
  },
  tab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    textDecoration: 'none',
    padding: '4px 8px',
    minWidth: 56,
  },
  icon: { fontSize: 20 },
  label: { fontSize: 10, fontWeight: 500 },
};
