import React from 'react';
import { IncomeRecord } from '../../lib/financialEngine';
import { Vehicle } from '../../types/database';
import { PeriodBoundary } from '../../lib/timezone';

interface LeaderboardCardProps {
  income: IncomeRecord[];
  vehicles: Vehicle[];
  today: PeriodBoundary;
  week: PeriodBoundary;
  month: PeriodBoundary;
}

function getTopVehicle(income: IncomeRecord[], boundary: PeriodBoundary, vehicles: Vehicle[]): { name: string; amount: number } | null {
  const vehicleMap = new Map<string, number>();
  const names = Object.fromEntries(vehicles.map((v) => [v.id, v.short_name || v.full_name || 'Araç']));
  income
    .filter((r) => r.recordDate >= boundary.start && r.recordDate <= boundary.end)
    .forEach((r) => {
      const vid = r.vehicleId || 'unknown';
      vehicleMap.set(vid, (vehicleMap.get(vid) || 0) + r.amount);
    });
  const sorted = [...vehicleMap.entries()].sort((a, b) => b[1] - a[1]);
  const [vid, amount] = sorted[0] ?? [null, 0];
  if (!vid || amount === 0) return null;
  return { name: names[vid] || 'Araç', amount };
}

const PERIODS: { key: 'today' | 'week' | 'month'; label: string }[] = [
  { key: 'today', label: 'Bugün' },
  { key: 'week', label: 'Hafta' },
  { key: 'month', label: 'Ay' },
];

export function LeaderboardCard({ income, vehicles, today, week, month }: LeaderboardCardProps) {
  const boundaries = { today, week, month };
  return (
    <div style={S.wrap}>
      {PERIODS.map((p) => {
        const w = getTopVehicle(income, boundaries[p.key], vehicles);
        return (
          <div key={p.key} style={S.item}>
            <span style={S.label}>{p.label}</span>
            {w ? (
              <span style={S.winner}>
                <span>1</span>
                <span>{w.name}</span>
                <span style={S.amount}>${Math.abs(w.amount).toLocaleString('en-US')}</span>
              </span>
            ) : (
              <span style={S.empty}>Henüz yok</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 20, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', marginBottom: 10 },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' },
  label: { fontSize: 11, color: '#9CA3AF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5 },
  winner: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#D4AF37', fontWeight: 800 },
  amount: { color: '#E8EAF2', fontWeight: 900 },
  empty: { fontSize: 13, color: '#6F748A' },
};
