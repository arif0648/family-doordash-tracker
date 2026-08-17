import React from 'react';
import { useMarketRates } from '../../lib/marketRates';

const money = (value: number | null, digits = 2) => value === null
  ? null
  : `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export function MarketRatesStrip({ realtimeStatus }: { realtimeStatus: 'connecting' | 'live' | 'offline' }) {
  const { usdBuy, usdSell, quarterGoldBuy, quarterGoldSell, source, sourceUpdatedAt, loading, error } = useMarketRates();
  const unavailable = !loading && Boolean(error);
  const time = sourceUpdatedAt?.toLocaleTimeString('tr-TR', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit',
  });

  return (
    <section className="home-glass" style={styles.wrap} aria-label="Türkiye piyasa fiyatları">
      <div style={styles.rates}>
        <RateItem icon="$" label="USD / TL" buy={money(usdBuy, 4)} sell={money(usdSell, 4)} loading={loading} />
        <div style={styles.divider} />
        <RateItem icon="◈" label="Çeyrek Altın" buy={money(quarterGoldBuy)} sell={money(quarterGoldSell)} loading={loading} />
      </div>
      <div style={styles.meta}>
        <span style={{ color: unavailable ? 'var(--negative)' : loading ? 'var(--text-secondary)' : 'var(--positive)' }}>
          ● {unavailable ? 'Veri alınamıyor' : loading ? 'Güncelleniyor' : 'Güncel'}
        </span>
        {!unavailable && source ? <span>Kaynak: {source}{time ? ` · ${time} (TR)` : ''}</span> : null}
        {realtimeStatus === 'offline' && loading ? <span>Çevrimdışı</span> : null}
      </div>
    </section>
  );
}

function RateItem({ icon, label, buy, sell, loading }: { icon: string; label: string; buy: string | null; sell: string | null; loading: boolean }) {
  return (
    <div style={styles.item}>
      <span style={styles.icon}>{icon}</span>
      <div style={styles.content}>
        <span style={styles.label}>{label}</span>
        {buy && sell ? (
          <div style={styles.prices}>
            <span><small style={styles.side}>ALIŞ</small><strong style={styles.value}>{buy}</strong></span>
            <span><small style={styles.side}>SATIŞ</small><strong style={styles.value}>{sell}</strong></span>
          </div>
        ) : <span style={styles.waiting}>{loading ? 'Veri bekleniyor' : 'Veri alınamıyor'}</span>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: '8px 10px 7px', minHeight: 64, borderRadius: 16, marginBottom: 10 },
  rates: { display: 'flex', alignItems: 'center', gap: 8 },
  item: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7 },
  content: { flex: 1, minWidth: 0 },
  icon: { width: 26, height: 26, flex: '0 0 26px', borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(60,200,237,.08)', color: '#75d7ee', fontWeight: 750 },
  label: { display: 'block', color: '#AAB6C5', fontSize: 9, textTransform: 'uppercase', letterSpacing: .55, marginBottom: 2 },
  prices: { display: 'flex', gap: 8, whiteSpace: 'nowrap' },
  side: { display: 'block', color: 'var(--muted)', fontSize: 6.5, letterSpacing: .45, lineHeight: 1 },
  value: { display: 'block', color: 'var(--text)', fontSize: 10.5, marginTop: 1 },
  waiting: { color: 'var(--muted)', fontSize: 9, fontWeight: 600 },
  divider: { width: 1, height: 35, background: 'rgba(255,255,255,.08)' },
  meta: { display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--muted)', fontSize: 7, lineHeight: 1.2, marginTop: 5 },
};
