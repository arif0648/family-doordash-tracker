import React from 'react';
import { useMarketRates } from '../../lib/marketRates';

export function MarketRatesStrip() {
  const { usdTry, quarterGoldTry, available, error } = useMarketRates();

  return (
    <section style={styles.wrap} aria-label="Piyasa kurları">
      <div style={styles.item}>
        <span style={styles.icon}>$</span>
        <div>
          <span style={styles.label}>USD / TRY</span>
          <strong style={styles.value}>{usdTry ? usdTry.toFixed(2) : '—'}</strong>
        </div>
      </div>
      <div style={styles.divider} />
      <div style={styles.item}>
        <span style={styles.icon}>◈</span>
        <div>
          <span style={styles.label}>Çeyrek Altın</span>
          <strong style={styles.value}>
            {quarterGoldTry ? `₺${quarterGoldTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '—'}
          </strong>
        </div>
      </div>
      <span style={styles.live}>{error ? '● Hata' : available ? '● canlı' : '● yükleniyor'}</span>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
    border: '1px solid rgba(168,85,247,.22)', borderRadius: 18,
    background: 'rgba(255,255,255,.045)', backdropFilter: 'blur(18px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)',
  },
  item: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 },
  icon: {
    width: 30, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center',
    background: 'rgba(168,85,247,.12)', color: '#C084FC', fontWeight: 800,
  },
  label: { display: 'block', color: '#94A3B8', fontSize: 9, textTransform: 'uppercase', letterSpacing: .6 },
  value: { display: 'block', color: '#F8FAFC', fontSize: 13, marginTop: 2 },
  divider: { width: 1, height: 28, background: 'rgba(255,255,255,.08)' },
  live: { color: '#34D399', fontSize: 9, whiteSpace: 'nowrap' },
};
