import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomSheet } from './BottomSheet';

interface QuickActionsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function QuickActionsSheet({ open, onClose }: QuickActionsSheetProps) {
  const navigate = useNavigate();

  const onSelect = (path: string) => {
    onClose();
    navigate(path);
  };

  const actions = [
    { path: '/kazanc', icon: '＋', label: 'Kazanç Ekle', color: 'var(--positive)' },
    { path: '/gider', icon: '−', label: 'Gider Ekle', color: 'var(--negative)' },
    { path: '/', icon: '⏱', label: 'Çalışma Yönet', color: 'var(--accent)' },
    { path: '/randevular', icon: '📅', label: 'Randevu Ekle', color: 'var(--brand)' },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="Hızlı İşlem">
      <div style={S.list}>
        {actions.map((a) => (
          <button
            key={a.path}
            style={S.row}
            onClick={() => onSelect(a.path)}
            aria-label={a.label}
          >
            <span style={{ ...S.icon, background: `${a.color}20`, color: a.color }}>{a.icon}</span>
            <span style={S.label}>{a.label}</span>
            <span style={S.chevron}>›</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

const S: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    borderRadius: 18,
    border: '1px solid var(--border)',
    background: 'var(--surface-raised)',
    color: 'var(--text)',
    padding: '0 14px',
    fontWeight: 700,
    fontSize: 15,
    transition: 'transform 120ms ease, background 120ms ease',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    fontSize: 18,
    fontWeight: 900,
    flexShrink: 0,
  },
  label: {
    flex: 1,
    textAlign: 'left',
  },
  chevron: {
    fontSize: 20,
    color: 'var(--muted)',
  },
};
