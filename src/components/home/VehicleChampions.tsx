import React, { useMemo, useState } from 'react';
import { Vehicle } from '../../types/database';
import { IncomeRecord, computeVehicleIncomeLeaderboard } from '../../lib/financialEngine';
import { boundaryForPeriod } from '../../lib/timezone';
import { formatMoney } from '../../lib/format';

type ChampionPeriod = 'today' | 'week' | 'month';

const periodButtons: Record<ChampionPeriod, string> = { today: 'Gün', week: 'Hafta', month: 'Ay' };

const titles: Record<ChampionPeriod, string> = { today: 'Günün Birincisi', week: 'Haftanın Birincisi', month: 'Ayın Birincisi' };
const PODIUM_GOLD = '#d7ad61';

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
    <section className="home-glass" style={S.section}>
      <div style={S.head}>
        <span style={S.kicker}>{titles[period]}</span>
        <div style={S.tabsSmall}>
          {(['today', 'week', 'month'] as ChampionPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              style={{
                ...S.tabSmall,
                background: period === p ? 'rgba(60,200,237,.11)' : 'transparent',
                color: period === p ? 'var(--text)' : 'var(--text-secondary)',
                boxShadow: period === p ? 'inset 0 0 0 1px rgba(60,200,237,.2)' : 'none',
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
            const isFirst = rankIndex === 0;
            return (
              <div key={v.vehicleId} style={{ ...S.podiumItem, ...(isFirst ? S.firstItem : {}), borderTopColor: PODIUM_GOLD }}>
                <div style={{ ...S.podiumRank, color: PODIUM_GOLD }}>{rankIndex + 1}</div>
                <div style={S.podiumName}>{v.shortName}</div>
                <div style={S.podiumAmount}>{formatMoney(v.amount, true)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={S.empty}>
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
    marginBottom: 14,
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  kicker: {
    fontSize: 13,
    letterSpacing: .1,
    fontWeight: 750,
    color: 'var(--text)',
  },
  tabsSmall: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
    width: 150,
    padding: 3,
    borderRadius: 10,
    background: 'rgba(255,255,255,.025)',
  },
  tabSmall: {
    border: 0,
    borderRadius: 8,
    padding: '6px 5px',
    fontSize: 10,
    fontWeight: 700,
    transition: 'color 120ms ease, background 120ms ease',
  },
  podium: {
    display: 'flex',
    gap: 7,
    alignItems: 'flex-end',
    minHeight: 112,
  },
  podiumItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    padding: '13px 7px 11px',
    borderRadius: 14,
    background: 'linear-gradient(160deg,rgba(255,255,255,.045),rgba(255,255,255,.012))',
    border: '1px solid var(--border)',
    borderTop: '2px solid',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04)',
  },
  firstItem: { paddingTop: 18, paddingBottom: 15, transform: 'translateY(-7px)', background: 'radial-gradient(circle at 50% 0,rgba(215,173,97,.055),transparent 62%),linear-gradient(160deg,rgba(255,255,255,.045),rgba(255,255,255,.012))' },
  podiumRank: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1,
  },
  podiumName: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text)',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'normal',
    lineHeight: 1.2,
    minHeight: 27,
    display: 'grid',
    placeItems: 'center',
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
    padding: '18px 12px',
    borderRadius: 18,
    background: 'var(--surface-raised)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    textAlign: 'center',
  },
};
