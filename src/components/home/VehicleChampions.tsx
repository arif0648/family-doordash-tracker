import React, { useMemo, useState } from 'react';
import { Vehicle } from '../../types/database';
import { IncomeRecord, computeVehicleIncomeLeaderboard } from '../../lib/financialEngine';
import { boundaryForPeriod } from '../../lib/timezone';
import { formatMoney } from '../../lib/format';

type ChampionPeriod = 'today' | 'week' | 'month';

const periodTitles: Record<ChampionPeriod, string> = {
  today: 'GÜNÜN İLK 3\'Ü',
  week: 'HAFTANIN İLK 3\'Ü',
  month: 'AYIN İLK 3\'Ü',
};

const periodButtons: Record<ChampionPeriod, string> = { today: 'Gün', week: 'Hafta', month: 'Ay' };

const VEHICLE_ICONS: Record<string, string> = {
  'Kia Sportage Prestige': '🚙',
  'Toyota Corolla XLE': '🚗',
  'Honda Accord Sport': '🚘',
};

interface VehicleChampionsProps {
  income: IncomeRecord[];
  vehicles: Vehicle[];
  now: Date;
}

export function VehicleChampions({ income, vehicles, now }: VehicleChampionsProps) {
  const [period, setPeriod] = useState<ChampionPeriod>('today');
  const boundary = useMemo(() => boundaryForPeriod(period, now), [period, now]);
  const result = useMemo(
    () => computeVehicleIncomeLeaderboard({ income, vehicles, boundary }),
    [income, vehicles, boundary]
  );
  const top3 = result.hasData ? result.ranking.slice(0, 3) : [];

  // Reorder for podium display: [2nd, 1st, 3rd]
  // If only 1 vehicle, show only 1st in center
  // If 2 vehicles, show [2nd, 1st]
  // If 3 vehicles, show [2nd, 1st, 3rd]
  let podiumOrder: typeof top3;
  if (top3.length === 1) {
    podiumOrder = [top3[0]]; // Only 1st, will be centered
  } else if (top3.length === 2) {
    podiumOrder = [top3[1], top3[0]]; // [2nd, 1st]
  } else if (top3.length >= 3) {
    podiumOrder = [top3[1], top3[0], top3[2]]; // [2nd, 1st, 3rd]
  } else {
    podiumOrder = [];
  }

  return (
    <section style={S.section}>
      <div style={S.head}>
        <span style={S.kicker}>{periodTitles[period]}</span>
        <div style={S.tabsSmall}>
          {(['today', 'week', 'month'] as ChampionPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              style={{
                ...S.tabSmall,
                background: period === p ? 'var(--accent)' : 'var(--surface-raised)',
                color: period === p ? '#062D46' : 'var(--text-secondary)',
              }}
              onClick={() => setPeriod(p)}
            >
              {periodButtons[p]}
            </button>
          ))}
        </div>
      </div>

      {podiumOrder.length > 0 ? (
        <div style={S.podium}>
          {podiumOrder.filter(v => v).map((v, i) => {
            const rankIndex = podiumOrder.length === 1 ? 0 : i === 0 ? 1 : i === 1 ? 0 : 2; // Map back to original rank
            const medal = ['🥇', '🥈', '🥉'][rankIndex];
            const isFirst = rankIndex === 0;
            return (
              <div key={v.vehicleId} style={{ ...S.podiumItem, flex: isFirst ? 1.4 : 1 }}>
                <div style={S.podiumRank}>{medal}</div>
                <div style={S.podiumIcon}>{VEHICLE_ICONS[v.shortName] || '🚗'}</div>
                <div style={S.podiumName}>{v.shortName}</div>
                <div style={S.podiumAmount}>{formatMoney(v.amount, true)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={S.empty}>
          <span style={S.emptyIcon}>🚗</span>
          <span>{periodButtons[period]} için henüz gelir kaydı yok.</span>
        </div>
      )}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: {
    padding: 16,
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-card)',
    marginBottom: 14,
  },
  head: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: 900,
    color: 'var(--gold)',
  },
  tabsSmall: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
    width: '100%',
  },
  tabSmall: {
    border: 0,
    borderRadius: 12,
    padding: '10px 8px',
    fontSize: 12,
    fontWeight: 800,
    transition: 'color 120ms ease, background 120ms ease',
  },
  podium: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
  },
  podiumItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 16,
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
  },
  podiumRank: {
    fontSize: 24,
    lineHeight: 1,
  },
  podiumIcon: {
    fontSize: 36,
    lineHeight: 1,
  },
  podiumName: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text)',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  podiumAmount: {
    fontSize: 13,
    fontWeight: 900,
    color: 'var(--text)',
    fontVariantNumeric: 'tabular-nums',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '26px 12px',
    borderRadius: 18,
    background: 'var(--surface-raised)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 24,
  },
};
