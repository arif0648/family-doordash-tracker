import React, { useMemo, useState } from 'react';
import { Vehicle } from '../../types/database';
import { IncomeRecord, computeVehicleIncomeLeaderboard } from '../../lib/financialEngine';
import { boundaryForPeriod } from '../../lib/timezone';
import { formatMoney } from '../../lib/format';

type ChampionPeriod = 'today' | 'week' | 'month';

const labels: Record<ChampionPeriod, string> = {
  today: 'Gün',
  week: 'Hafta',
  month: 'Ay',
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

  return (
    <section style={S.section}>
      <div style={S.head}>
        <span style={S.kicker}>🏆 ARAÇ ŞAMPİYONLARI</span>
        <div style={S.tabs}>
          {(['today', 'week', 'month'] as ChampionPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              style={{
                ...S.tab,
                background: period === p ? 'var(--accent)' : 'transparent',
                color: period === p ? '#062D46' : 'var(--text-secondary)',
              }}
              onClick={() => setPeriod(p)}
            >
              {labels[p]}
            </button>
          ))}
        </div>
      </div>

      {result.hasData ? (
        <div style={S.body}>
          <div style={S.podium}>
            <span style={S.rank}>🥇</span>
            <div style={S.winner}>
              <div style={S.winnerName}>{result.winner.shortName}</div>
              <div style={S.winnerAmount}>{formatMoney(result.winner.amount, true)}</div>
            </div>
          </div>
          {result.second ? (
            <div style={S.second}>
              <span>2. {result.second.shortName}</span>
              <span>{formatMoney(result.second.amount, true)}</span>
            </div>
          ) : null}
          <div style={S.gap}>
            {result.second
              ? `+${formatMoney(result.winner.amount - result.second.amount, true)} fark`
              : `${result.ranking.length} araç arasında lider`}
          </div>
        </div>
      ) : (
        <div style={S.empty}>
          <span style={S.emptyIcon}>🚀</span>
          <span>{labels[period]}ün lideri henüz belli değil.</span>
          <span>İlk kazançla yarış başlıyor.</span>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: 900,
    color: 'var(--gold)',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    background: 'var(--surface-raised)',
  },
  tab: {
    border: 0,
    borderRadius: 10,
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    background: 'transparent',
    transition: 'color 120ms ease, background 120ms ease',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  podium: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    background: 'rgba(251, 191, 36, 0.08)',
    border: '1px solid rgba(251, 191, 36, 0.18)',
  },
  rank: {
    fontSize: 28,
    lineHeight: 1,
  },
  winner: {
    flex: 1,
  },
  winnerName: {
    fontSize: 17,
    fontWeight: 900,
    color: 'var(--gold)',
    marginBottom: 4,
  },
  winnerAmount: {
    fontSize: 22,
    fontWeight: 900,
    color: 'var(--text)',
    letterSpacing: -1,
  },
  second: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: 14,
    background: 'var(--surface-raised)',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  gap: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--positive)',
    textAlign: 'center',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '24px 12px',
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
