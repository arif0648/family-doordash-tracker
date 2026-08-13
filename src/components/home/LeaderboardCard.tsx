import React from 'react';
import { IncomeRecord } from '../../lib/financialEngine';
import { Profile } from '../../types/database';
import { PeriodBoundary } from '../../lib/timezone';

interface LeaderboardCardProps {
  income: IncomeRecord[];
  profiles: Profile[];
  today: PeriodBoundary;
  week: PeriodBoundary;
  month: PeriodBoundary;
}

function getWinner(income: IncomeRecord[], boundary: PeriodBoundary, profiles: Profile[]): { name: string; amount: number } | null {
  const map = new Map<string, number>();
  income
    .filter((r) => r.recordDate >= boundary.start && r.recordDate <= boundary.end)
    .forEach((r) => {
      const uid = r.userId || 'unknown';
      map.set(uid, (map.get(uid) || 0) + r.amount);
    });
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const [userId, amount] = sorted[0] ?? [null, 0];
  if (!userId || amount === 0) return null;
  const member = profiles.find((p) => p.user_id === userId);
  return { name: member?.display_name || 'Bilinmeyen', amount };
}

const PERIODS: { key: 'today' | 'week' | 'month'; label: string }[] = [
  { key: 'today', label: 'Bugün' },
  { key: 'week', label: 'Hafta' },
  { key: 'month', label: 'Ay' },
];

export function LeaderboardCard({ income, profiles, today, week, month }: LeaderboardCardProps) {
  const boundaries = { today, week, month };
  return (
    <div style={S.wrap}>
      {PERIODS.map((p) => {
        const w = getWinner(income, boundaries[p.key], profiles);
        return (
          <div key={p.key} style={S.item}>
            <span style={S.label}>{p.label}</span>
            {w ? (
              <span style={S.winner}>● {w.name} ${w.amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
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
  wrap: { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', marginBottom: 10, overflowX: 'auto' },
  item: { display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  label: { fontSize: 10, color: '#9CA3AF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5 },
  winner: { fontSize: 13, color: '#D4AF37', fontWeight: 800 },
  empty: { fontSize: 13, color: '#6F748A' },
};
