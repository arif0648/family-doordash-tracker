import React from 'react';
import { colors, type } from '../../theme/theme';

interface MarketTickerProps {
  usdRate?: number;
  usdChangePercent?: number;
  goldPrice?: number;
  goldChangePercent?: number;
  onPress?: () => void;
}

/**
 * Ekranın kenarında düşük kontrastlı Dolar/Altın ticker'ı.
 * Bu bileşen SADECE gösterim yapar — veri çekmez. Değerleri gerçek
 * zamanlı bir kaynaktan (bkz. useMarketTicker.ts örneği) sen sağlamalısın;
 * sabit/uydurma fiyat KULLANILMAMALI (brief'te de böyle isteniyor).
 * Prop'lar undefined geldiği sürece "—" gösterilir, sahte veri basılmaz.
 */
export function MarketTicker({ usdRate, usdChangePercent, goldPrice, goldChangePercent, onPress }: MarketTickerProps) {
  return (
    <button type="button" onClick={onPress} style={styles.wrap}>
      <TickerItem label="USD" value={usdRate !== undefined ? `$${usdRate.toFixed(2)}` : '—'} change={usdChangePercent} />
      <div style={styles.sep} />
      <TickerItem label="GOLD" value={goldPrice !== undefined ? `$${goldPrice.toLocaleString('en-US')}` : '—'} change={goldChangePercent} />
    </button>
  );
}

function TickerItem({ label, value, change }: { label: string; value: string; change?: number }) {
  const up = (change ?? 0) >= 0;
  return (
    <div style={styles.item}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>{value}</span>
      {change !== undefined && (
        <span style={{ ...styles.change, color: up ? colors.positive : colors.negative }}>
          {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </span>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '8px 4px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    opacity: 0.7,
  },
  sep: { width: 1, height: 14, background: colors.hairline },
  item: { display: 'flex', alignItems: 'baseline', gap: 5 },
  label: { ...type.caption, fontSize: 10, color: colors.textMuted },
  value: { fontSize: 12, fontWeight: 700, color: colors.textSecondary },
  change: { fontSize: 10.5, fontWeight: 700 },
};
