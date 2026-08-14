import React, { useMemo } from 'react';
import { Vehicle } from '../../types/database';
import { IncomeRecord, computeVehicleIncomeLeaderboard } from '../../lib/financialEngine';
import { weekBoundary } from '../../lib/timezone';
import { formatMoney } from '../../lib/format';

interface VehicleContributionsProps {
  income: IncomeRecord[];
  vehicles: Vehicle[];
  now: Date;
}

export function VehicleContributions({ income, vehicles, now }: VehicleContributionsProps) {
  const boundary = useMemo(() => weekBoundary(now), [now]);
  const result = useMemo(
    () => computeVehicleIncomeLeaderboard({ income, vehicles, boundary }),
    [income, vehicles, boundary]
  );

  if (!result.hasData) return null;

  const total = result.ranking.reduce((s, v) => s + v.amount, 0);

  return (
    <section style={S.section}>
      <div style={S.head}>
        <span style={S.kicker}>HAFTALIK ARAÇ KATKILARI</span>
        <span style={S.total}>{formatMoney(total, true)}</span>
      </div>
      <div style={S.list}>
        {result.ranking.map((v) => {
          const pct = total > 0 ? Math.round((v.amount / total) * 100) : 0;
          return (
            <div key={v.vehicleId} style={S.row}>
              <div style={S.name}>{v.shortName}</div>
              <div style={S.barWrap}>
                <div style={S.track}>
                  <div style={{ ...S.fill, width: `${pct}%` }} />
                </div>
                <span style={S.pct}>%{pct}</span>
              </div>
              <div style={S.amount}>{formatMoney(v.amount)}</div>
            </div>
          );
        })}
      </div>
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
    color: 'var(--accent)',
  },
  total: {
    fontSize: 14,
    fontWeight: 900,
    color: 'var(--text)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 70px',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  barWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 8,
    background: 'var(--surface-raised)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 8,
    background: 'var(--accent)',
    transition: 'width 0.4s ease',
  },
  pct: {
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    width: 30,
    textAlign: 'right',
  },
  amount: {
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--text)',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
};
