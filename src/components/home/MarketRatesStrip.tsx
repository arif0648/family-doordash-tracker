import React from 'react';
import { useMarketRates } from '../../lib/marketRates';

export function MarketRatesStrip({ realtimeStatus }: { realtimeStatus: 'connecting' | 'live' | 'offline' }) {
  const { usdTry, quarterGoldTry, updatedAt, loading, error } = useMarketRates();
  const ageMinutes = updatedAt ? Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / 60_000)) : null;

  return (
    <section className="home-glass" style={styles.wrap} aria-label="Piyasa kurları" title="USD/TRY: Frankfurter. Çeyrek altın: PAX Gold spot ons fiyatından 1,608 g saf altın karşılığı; kuyumcu satış fiyatı değildir.">
      <div style={styles.item}>
        <span style={styles.icon}>$</span>
        <div>
          <span style={styles.label}>USD / TRY</span>
          <strong style={styles.value}>{usdTry ? usdTry.toFixed(2) : <span style={styles.waiting}>Veri bekleniyor</span>}</strong>
        </div>
      </div>
      <div style={styles.divider} />
      <div style={styles.item}>
        <span style={styles.icon}>◈</span>
        <div>
          <span style={styles.label}>Çeyrek Altın</span>
          <strong style={styles.value}>
            {quarterGoldTry ? `₺${quarterGoldTry.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : <span style={styles.waiting}>Veri bekleniyor</span>}
          </strong>
        </div>
      </div>
      <span style={{ ...styles.live, color: error ? 'var(--negative)' : loading ? 'var(--text-secondary)' : 'var(--positive)' }}>
        ● {error && !updatedAt ? 'Alınamadı' : loading ? 'Güncelleniyor' : updatedAt ? 'Güncel' : realtimeStatus === 'offline' ? 'Çevrimdışı' : 'Bekleniyor'}
        {ageMinutes !== null ? <small style={styles.age}>{ageMinutes === 0 ? 'şimdi' : `${ageMinutes} dk önce`}</small> : null}
      </span>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px',
    minHeight: 50, borderRadius: 16, marginBottom: 10,
  },
  item: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 },
  icon: {
    width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center',
    background: 'rgba(60,200,237,.08)', color: '#75d7ee', fontWeight: 750,
  },
  label: { display: 'block', color: '#94A3B8', fontSize: 9, textTransform: 'uppercase', letterSpacing: .6 },
  value: { display: 'block', color: 'var(--text)', fontSize: 12, marginTop: 1, whiteSpace: 'nowrap' },
  waiting: { color: 'var(--muted)', fontSize: 9, fontWeight: 600 },
  divider: { width: 1, height: 28, background: 'rgba(255,255,255,.08)' },
  live: { fontSize: 8, whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 },
  age: { color: 'var(--muted)', fontSize: 7, fontWeight: 500 },
};
