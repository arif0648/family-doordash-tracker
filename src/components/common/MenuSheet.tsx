import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomSheet } from './BottomSheet';

interface MenuSheetProps {
  open: boolean;
  onClose: () => void;
}

const items = [
  { path: '/araclar', icon: '◇', label: 'Araçlar' },
  { path: '/sabit-giderler', icon: '⌂', label: 'Sabit Giderler' },
  { path: '/randevular', icon: '□', label: 'Randevular' },
  { path: '/bildirimler', icon: '○', label: 'Bildirimler' },
  { path: '/raporlar', icon: '▥', label: 'Raporlar' },
  { path: '/profil', icon: '◎', label: 'Profil' },
];

export function MenuSheet({ open, onClose }: MenuSheetProps) {
  const navigate = useNavigate();

  const onSelect = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Menü">
      <div style={S.grid}>
        {items.map((item) => (
          <button
            key={item.path}
            style={S.item}
            onClick={() => onSelect(item.path)}
            aria-label={item.label}
          >
            <span style={S.icon}>{item.icon}</span>
            <span style={S.label}>{item.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

const S: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 74,
    borderRadius: 15,
    border: '1px solid var(--border)',
    background: 'var(--surface-raised)',
    color: 'var(--text)',
    padding: 10,
    fontWeight: 700,
    fontSize: 12,
    transition: 'transform 120ms ease, background 120ms ease',
  },
  icon: {
    fontSize: 20,
    color: 'var(--accent)',
    lineHeight: 1,
  },
  label: {
    color: 'var(--text-secondary)',
  },
};
