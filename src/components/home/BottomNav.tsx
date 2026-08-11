import React from 'react';
import { colors } from '../../theme/theme';

export type BottomNavTab = 'home' | 'transactions' | 'doordash' | 'vehicles' | 'more';

const TABS: { key: BottomNavTab; label: string; icon: string }[] = [
  { key: 'home', label: 'Ana Sayfa', icon: '🏠' },
  { key: 'transactions', label: 'Gelir/Gider', icon: '💵' },
  { key: 'doordash', label: 'DoorDash', icon: '🚗' },
  { key: 'vehicles', label: 'Araçlar', icon: '🔧' },
  { key: 'more', label: 'Daha Fazla', icon: '⋯' },
];

interface BottomNavProps {
  active: BottomNavTab;
  onNavigate: (tab: BottomNavTab) => void;
}

/**
 * Alt navigasyon. Genelde tüm sayfalarda ortak olduğu için bunu
 * HomePage.tsx'in İÇİNE değil, sayfaları saran ortak layout/App shell'ine
 * yerleştirmen daha doğru olur (aksi halde her sayfaya ayrı ayrı eklemen
 * gerekir). Yönlendirme (routing) kütüphanenden bağımsız kalsın diye
 * `onNavigate` callback'i ile çalışıyor — kendi router'ına burada bağla.
 */
export function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav style={styles.wrap}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            style={styles.tabButton}
            onClick={() => onNavigate(tab.key)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span style={{ fontSize: 19, opacity: isActive ? 1 : 0.6 }}>{tab.icon}</span>
            <span style={{ ...styles.label, color: isActive ? colors.neonGreen : colors.textMuted }}>
              {tab.label}
            </span>
            {isActive && <span style={styles.activeDot} />}
          </button>
        );
      })}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    background: 'rgba(5, 7, 13, 0.9)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderTop: `1px solid ${colors.hairline}`,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 30,
  },
  tabButton: {
    flex: 1,
    minHeight: 56,
    background: 'transparent',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
    cursor: 'pointer',
  },
  label: { fontSize: 10, fontWeight: 700 },
  activeDot: {
    position: 'absolute',
    top: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    background: colors.neonGreen,
    boxShadow: `0 0 6px ${colors.neonGreenGlow}`,
  },
};
