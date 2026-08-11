import React from 'react';
import type { VehicleSummary } from '../../lib/financialEngine';
import { colors, formatMiles, glassCard, type } from '../../theme/theme';

export interface VehicleCardProps {
  shortName: string;
  summary: VehicleSummary;
  showFixedShare?: boolean;
  /** En kârlı araç bu ayın/periyodun lideri ise küçük bir rozet gösterir. */
  isTopPerformer?: boolean;
}

/**
 * Tek bir aracın performans kartı — ARAÇLAR listesinde ve araç detayında
 * kullanılır. Aynı import yolunda (../home/VehicleCard) hem HomePage hem
 * VehiclesPage tarafından kullanıldığı için prop şekli değiştirilmedi.
 *
 * NOT — "Saatlik" satırı: financialEngine.ts / mileageEngine.ts içinde
 * "çalışılan saat" verisi tutulmuyor, bu yüzden $/saat burada hesaplanamıyor
 * ve gösterilmiyor. $/mil ise net kâr / milesDriven üzerinden gerçek veriyle
 * hesaplanıyor.
 */
export function VehicleCard({ shortName, summary, showFixedShare, isTopPerformer }: VehicleCardProps) {
  const isProfit = summary.net >= 0;
  const accent = isProfit ? colors.positive : colors.negative;
  const perMile = summary.milesDriven > 0 ? summary.net / summary.milesDriven : null;

  return (
    <div style={{ ...glassCard(), padding: 16, position: 'relative' }}>
      {isTopPerformer && (
        <span style={styles.topBadge}>
          <span style={{ color: colors.neonGreen }}>★</span> EN KÂRLI
        </span>
      )}

      <div style={styles.headerRow}>
        <span style={{ ...type.sectionTitle, fontSize: 14 }}>{shortName}</span>
        <span style={{ ...styles.statusPill, background: isProfit ? colors.neonGreenSoft : colors.negativeSoft, color: accent }}>
          {isProfit ? 'KÂRDA' : 'ZARARDA'}
        </span>
      </div>

      <p style={{ ...type.caption, marginTop: 10, marginBottom: 2 }}>NET KÂR</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: accent, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        {isProfit ? '+' : '-'}${Math.abs(summary.net).toLocaleString('en-US')}
      </p>

      <div style={styles.statRow}>
        {perMile !== null && (
          <Stat label="MİL BAŞINA" value={`$${perMile.toFixed(2)}`} />
        )}
        <Stat label="MİL" value={formatMiles(summary.milesDriven)} />
        <Stat label="GELİR" value={`$${summary.income.toLocaleString('en-US')}`} color={colors.positive} />
        {showFixedShare && summary.fixedShare > 0 && (
          <Stat label="SABİT PAY" value={`$${summary.fixedShare.toLocaleString('en-US')}`} color={colors.textSecondary} />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ ...type.caption, fontSize: 10.5 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: color ?? colors.textPrimary, margin: 0 }}>{value}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topBadge: {
    position: 'absolute',
    top: -9,
    right: 14,
    background: colors.bgBase,
    border: `1px solid ${colors.neonGreen}`,
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.3,
    color: colors.textPrimary,
  },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { fontSize: 10.5, fontWeight: 800, padding: '4px 9px', borderRadius: 999, letterSpacing: 0.3 },
  statRow: { display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' },
};
