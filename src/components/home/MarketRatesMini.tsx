import React, { useState } from 'react';
import { useMarketRates } from '../../lib/marketRates';

export function MarketRatesMini() {
  const { usdTry, quarterGoldTry, available, error } = useMarketRates();
  const [open, setOpen] = useState(false);

  return (
    <div style={styles.wrap} onClick={() => setOpen(v => !v)}>
      <span style={{ ...styles.dot, background: error ? '#F43F5E' : available ? '#10B981' : '#F59E0B' }} />
      <span style={styles.rate}>$ {usdTry?.toFixed(2) ?? '—'}</span>
      <span style={styles.gold}>◈ {quarterGoldTry ? quarterGoldTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) : '—'}</span>
      {open && (
        <div style={styles.panel} onClick={e => e.stopPropagation()}>
          <RateRow label="USD / TRY" value={usdTry ? `$${usdTry.toFixed(2)}` : null} />
          <RateRow label="Çeyrek Altın" value={quarterGoldTry ? `₺${quarterGoldTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : null} />
          <span style={styles.status}>{error ? 'Hata' : available ? 'Canlı' : 'Yükleniyor'}</span>
        </div>
      )}
    </div>
  );
}

function RateRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={styles.row}>
      <span>{label}</span>
      <span style={styles.rowValue}>{value ?? '—'}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8A90A6', cursor: 'pointer', position: 'relative' },
  dot: { width: 6, height: 6, borderRadius: 999, background: '#10B981' },
  rate: {},
  gold: {},
  panel: { position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, minWidth: 170, padding: 12, borderRadius: 14, background: '#141926', border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 18px 50px rgba(0,0,0,.4)' },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#E8EAF2', marginBottom: 8 },
  rowValue: { fontWeight: 700 },
  status: { display: 'block', textAlign: 'right', fontSize: 10, color: '#8A90A6', marginTop: 4 },
};
