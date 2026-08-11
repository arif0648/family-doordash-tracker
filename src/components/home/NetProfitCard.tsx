import React from 'react';
import { colors, formatMiles, formatMoney, glassCard, moneyColor, type } from '../../theme/theme';

export interface NetProfitCardProps {
  periodLabel: string; // "BUGÜN" | "BU HAFTA" | "BU AY" | "BU YIL"
  totalIncome: number;
  totalExpense: number;
  net: number;
  totalMiles: number;
  /** Saat verisi henüz sistemde tutulmuyorsa undefined bırak — satır otomatik gizlenir. */
  perHour?: number;
  /** Son birkaç günün/periyodun net değerleri — küçük trend çizgisi için. Boşsa grafik gizlenir. */
  trend?: number[];
}

/**
 * Ana ekranın en geniş ve en önemli kartı.
 * Kâr pozitifse yeşil, negatifse kırmızı vurgu.
 */
export function NetProfitCard({
  periodLabel,
  totalIncome,
  totalExpense,
  net,
  totalMiles,
  perHour,
  trend,
}: NetProfitCardProps) {
  const isPositive = net >= 0;
  const accent = isPositive ? colors.neonGreen : colors.negative;
  const perMile = totalMiles > 0 ? net / totalMiles : null;

  return (
    <div
      style={{
        ...glassCard({ glow: isPositive ? 'green' : 'red', strong: true }),
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ ...styles.topBar, background: accent }} />

      <div style={styles.headerRow}>
        <span style={type.eyebrow}>{periodLabel}</span>
        {trend && trend.length > 1 && <Sparkline values={trend} color={accent} />}
      </div>

      <p style={{ ...type.caption, marginTop: 6, marginBottom: 2 }}>NET KÂR</p>
      <p style={{ ...type.displayValue, color: accent, margin: 0 }}>{formatMoney(net)}</p>

      <div style={styles.breakdownRow}>
        <Breakdown label="GELİR" value={totalIncome} color={colors.positive} />
        <div style={styles.divider} />
        <Breakdown label="GİDER" value={-Math.abs(totalExpense)} color={colors.negative} showRaw={totalExpense} />
        <div style={styles.divider} />
        <Breakdown label="NET" value={net} color={moneyColor(net)} />
      </div>

      <div style={styles.footerRow}>
        {perHour !== undefined && <span style={styles.footerStat}>${perHour.toFixed(2)} / saat</span>}
        {perMile !== null && <span style={styles.footerStat}>${perMile.toFixed(2)} / mil</span>}
        <span style={styles.footerStat}>{formatMiles(totalMiles)}</span>
      </div>
    </div>
  );
}

function Breakdown({
  label,
  value,
  color,
  showRaw,
}: {
  label: string;
  value: number;
  color: string;
  showRaw?: number;
}) {
  const display = showRaw !== undefined ? showRaw : value;
  return (
    <div style={styles.breakdownItem}>
      <p style={type.caption}>{label}</p>
      <p style={{ ...type.body, fontSize: 15, fontWeight: 700, color, margin: 0 }}>
        ${Math.abs(display).toLocaleString('en-US')}
      </p>
    </div>
  );
}

/** Bağımlılıksız, hafif SVG trend çizgisi. Kütüphane gerektirmez. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 72;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, opacity: 0.9 },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  breakdownRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 18,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: '12px 8px',
  },
  breakdownItem: { flex: 1, textAlign: 'center' },
  divider: { width: 1, height: 28, background: colors.hairline },
  footerRow: { display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' },
  footerStat: { ...type.caption, color: colors.textSecondary, fontWeight: 700 },
};
