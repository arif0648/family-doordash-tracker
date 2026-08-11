import React from 'react';
import { colors, formatMiles, glassCard, type } from '../../theme/theme';

interface DailyPerformanceSummaryProps {
  totalIncome: number;
  totalExpense: number;
  net: number;
  totalMiles: number;
  /** Vardiya/saat verisi henüz sistemde tutulmuyorsa undefined bırak — o hücreler "—" gösterir. */
  totalShifts?: number;
  totalHours?: number;
}

/**
 * "BUGÜNÜN PERFORMANSI" — ana ekranın alt bölümündeki özet ızgara.
 * Vardiya/saat sayısı için ayrı bir veri kaynağı (shift log) gerekiyor;
 * bağlanana kadar bu iki hücre "—" gösterir.
 */
export function DailyPerformanceSummary({
  totalIncome,
  totalExpense,
  net,
  totalMiles,
  totalShifts,
  totalHours,
}: DailyPerformanceSummaryProps) {
  return (
    <div style={{ ...glassCard(), padding: 16 }}>
      <p style={{ ...type.eyebrow, marginBottom: 12 }}>BUGÜNÜN PERFORMANSI</p>
      <div style={styles.grid}>
        <Cell label="VARDİYA" value={totalShifts !== undefined ? String(totalShifts) : '—'} />
        <Cell label="SAAT" value={totalHours !== undefined ? totalHours.toFixed(1) : '—'} />
        <Cell label="MİL" value={formatMiles(totalMiles)} />
        <Cell label="GELİR" value={`$${totalIncome.toLocaleString('en-US')}`} color={colors.positive} />
        <Cell label="GİDER" value={`$${totalExpense.toLocaleString('en-US')}`} color={colors.negative} />
        <Cell
          label="NET KÂR"
          value={`${net >= 0 ? '+' : '-'}$${Math.abs(net).toLocaleString('en-US')}`}
          color={net >= 0 ? colors.neonGreen : colors.negative}
        />
      </div>
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ ...type.caption, fontSize: 10.5 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: color ?? colors.textPrimary, margin: '2px 0 0' }}>{value}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', rowGap: 16, columnGap: 8 },
};
