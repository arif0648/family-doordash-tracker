import React from 'react';
import { colors, radius, type } from '../../theme/theme';
import type { Period } from '../../lib/financialEngine';

const LABELS: Record<Period, string> = { today: 'BUGÜN', week: 'HAFTA', month: 'AY' };

interface PeriodSelectorProps {
  value: Period;
  onChange: (p: Period) => void;
  /**
   * 'YIL' sekmesi tasarımda var ama Period tipi şu an yalnızca
   * today/week/month destekliyor (financialEngine.ts + timezone.ts
   * güncellenmeden yıllık hesap yapılamaz). Bu yüzden sekme görünür
   * ama devre dışı — bkz. yanıttaki "YIL sekmesi" notu.
   */
  yearEnabled?: boolean;
}

export function PeriodSelector({ value, onChange, yearEnabled = false }: PeriodSelectorProps) {
  const periods: Period[] = ['today', 'week', 'month'];

  return (
    <div style={styles.wrap}>
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          style={{
            ...styles.button,
            background: value === p ? colors.neonGreen : 'transparent',
            color: value === p ? '#0B1120' : colors.textSecondary,
          }}
        >
          {LABELS[p]}
        </button>
      ))}
      <button
        type="button"
        disabled={!yearEnabled}
        style={{
          ...styles.button,
          background: 'transparent',
          color: colors.textMuted,
          opacity: yearEnabled ? 1 : 0.45,
          cursor: yearEnabled ? 'pointer' : 'not-allowed',
        }}
        title={yearEnabled ? undefined : 'Yıllık görünüm yakında'}
      >
        YIL
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    background: colors.bgCard,
    border: `1px solid ${colors.hairline}`,
    borderRadius: radius.md,
    padding: 4,
    gap: 2,
  },
  button: {
    flex: 1,
    padding: '10px 0',
    borderRadius: radius.sm,
    border: 'none',
    ...type.caption,
    fontSize: 12.5,
    letterSpacing: 0.4,
  },
};
