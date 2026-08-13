import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

export function QuickAddButton() {
  const [open, setOpen] = useState(false);
  return (
    <div style={S.wrap}>
      {open && (
        <div style={S.menu}>
          <NavLink to="/kazanc" style={S.item} onClick={() => setOpen(false)}>Kazanç</NavLink>
          <NavLink to="/gider" style={S.item} onClick={() => setOpen(false)}>Gider</NavLink>
          <NavLink to="/kredi-kartlari" style={S.item} onClick={() => setOpen(false)}>Kart Ödemesi</NavLink>
        </div>
      )}
      <button style={S.fab} onClick={() => setOpen(v => !v)}>＋</button>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { position: 'fixed', bottom: 'calc(70px + env(safe-area-inset-bottom))', right: 18, zIndex: 90, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  fab: { width: 58, height: 58, borderRadius: 999, border: 0, background: '#38BDF8', color: '#0A0E1A', fontSize: 28, fontWeight: 900, boxShadow: '0 8px 24px rgba(56,189,248,.35)' },
  menu: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 },
  item: { padding: '10px 16px', borderRadius: 12, background: '#141926', color: '#E8EAF2', textDecoration: 'none', fontSize: 13, fontWeight: 800, border: '1px solid rgba(255,255,255,.07)', textAlign: 'right' },
};
