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

interface Winner {
  name: string;
  amount: number;
}

function getWinner(income: IncomeRecord[], boundary: PeriodBoundary, profiles: Profile[]): Winner | null {
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
  const name = member?.display_name || 'Bilinmeyen';
  return { name, amount };
}

const PERIODS: { key: 'today' | 'week' | 'month'; label: string; icon: string }[] = [
  { key: 'today', label: 'Günün 1\'.si', icon: '🏆' },
  { key: 'week', label: 'Haftanın 1\'.si', icon: '🥇' },
  { key: 'month', label: 'Ayın 1\'.si', icon: '👑' },
];

const GRADIENTS = [
  'linear-gradient(135deg, #FDE68A, #F59E0B)',
  'linear-gradient(135deg, #E5E7EB, #9CA3AF)',
  'linear-gradient(135deg, #FDBA74, #D97706)',
];

const EMPTY_GRADIENT = 'linear-gradient(135deg, rgba(55,65,81,.9), rgba(31,41,55,.9))';

export function LeaderboardCard({ income, profiles, today, week, month }: LeaderboardCardProps) {
  const boundary = { today, week, month };
  const winners = [
    getWinner(income, boundary.today, profiles),
    getWinner(income, boundary.week, profiles),
    getWinner(income, boundary.month, profiles),
  ];

  return (
    <section style={S.section}>
      <div style={S.head}>
        <span style={S.kicker}>🏆 PERFORMANS</span>
        <h2 style={S.title}>Aile Sıralaması</h2>
      </div>

      <div style={S.podium}>
        {PERIODS.map((p, i) => {
          const w = winners[i];
          return (
            <div key={p.key} style={{ ...S.podiumCard, background: w ? GRADIENTS[i] : EMPTY_GRADIENT }}>
              <div style={S.podiumIcon}>{p.icon}</div>
              <div style={S.podiumLabel}>{p.label}</div>
              <div style={S.podiumName}>{w ? w.name : 'Henüz yok'}</div>
              <div style={S.podiumAmount}>{w ? `$${w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</div>
            </div>
          );
        })}
      </div>

      <div style={S.list}>
        {PERIODS.map((p, i) => {
          const w = winners[i];
          return (
            <div key={p.key} style={S.row}>
              <div style={S.rowLeft}>
                <span style={S.rowIcon}>{p.icon}</span>
                <div>
                  <div style={S.rowLabel}>{p.label}</div>
                  <div style={S.rowName}>{w ? w.name : 'Henüz kazanan yok'}</div>
                </div>
              </div>
              <div style={{ ...S.rowAmount, color: w ? '#34D399' : '#9CA3AF' }}>{w ? `$${w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: {
    padding: 18,
    borderRadius: 24,
    background: 'linear-gradient(145deg, rgba(25,18,56,.96), rgba(7,9,21,.98))',
    border: '1px solid rgba(168,85,247,.15)',
    boxShadow: '0 24px 65px rgba(0,0,0,.35)',
    marginBottom: 10,
  },
  head: { marginBottom: 14 },
  kicker: { fontSize: 9, letterSpacing: 2, color: '#9C8BEF', fontWeight: 900 },
  title: { fontSize: 18, fontWeight: 800, margin: '4px 0 0', color: '#fff' },
  podium: { display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 },
  podiumCard: {
    minWidth: 110,
    padding: 14,
    borderRadius: 20,
    color: '#1F2937',
    textAlign: 'center',
    boxShadow: '0 12px 30px rgba(0,0,0,.35)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  podiumIcon: { fontSize: 28, lineHeight: 1 },
  podiumLabel: { fontSize: 9, fontWeight: 900, letterSpacing: .6 },
  podiumName: { fontSize: 15, fontWeight: 900, minHeight: 20 },
  podiumAmount: { fontSize: 16, fontWeight: 900, opacity: .9 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' },
  rowLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  rowIcon: { fontSize: 20 },
  rowLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 700 },
  rowName: { fontSize: 15, fontWeight: 800, color: '#fff' },
  rowAmount: { fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap' },
};
