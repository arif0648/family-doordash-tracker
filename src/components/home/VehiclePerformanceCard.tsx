import React from 'react';
import { IncomeRecord } from '../../lib/financialEngine';
import { Vehicle } from '../../types/database';
import { PeriodBoundary } from '../../lib/timezone';

interface VehiclePerformanceCardProps {
  income: IncomeRecord[];
  vehicles: Vehicle[];
  month: PeriodBoundary;
}

export function VehiclePerformanceCard({ income, vehicles, month }: VehiclePerformanceCardProps) {
  const names = Object.fromEntries(vehicles.map((v) => [v.id, v.short_name || v.full_name || 'Araç']));
  const map = new Map<string, number>();
  income
    .filter((r) => r.recordDate >= month.start && r.recordDate <= month.end)
    .forEach((r) => {
      const vid = r.vehicleId || 'unknown';
      map.set(vid, (map.get(vid) || 0) + r.amount);
    });
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const [first, second, third] = [sorted[0], sorted[1], sorted[2]];

  return (
    <section style={S.section}>
      <div style={S.kicker}>ARAÇ PERFORMANSI</div>
      <h2 style={S.title}>Ayın 1.si</h2>
      {first ? (
        <div style={S.podium}>
          <div style={S.first}>
            <span style={S.rank}>🥇</span>
            <span style={S.name}>{names[first[0]]}</span>
            <span style={S.amount}>${first[1].toLocaleString('en-US')}</span>
          </div>
          {second ? (
            <div style={S.row}>
              <span>🥈 {names[second[0]]}</span>
              <span>${second[1].toLocaleString('en-US')}</span>
            </div>
          ) : null}
          {third ? (
            <div style={S.row}>
              <span>🥉 {names[third[0]]}</span>
              <span>${third[1].toLocaleString('en-US')}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <p style={S.empty}>Bu ay henüz kazanç yok.</p>
      )}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: { padding: 16, borderRadius: 20, background: 'linear-gradient(145deg, rgba(25,18,56,.96), rgba(7,9,21,.98))', border: '1px solid rgba(168,85,247,.15)', marginBottom: 10 },
  kicker: { fontSize: 9, letterSpacing: 2, color: '#9C8BEF', fontWeight: 900 },
  title: { fontSize: 20, fontWeight: 900, margin: '4px 0 12px' },
  podium: { display: 'flex', flexDirection: 'column', gap: 8 },
  first: { display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, background: 'rgba(212,175,55,.12)', border: '1px solid rgba(212,175,55,.25)', fontSize: 16, fontWeight: 900 },
  rank: { fontSize: 22 },
  name: { flex: 1, color: '#D4AF37' },
  amount: { color: '#E8EAF2' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)', fontSize: 13, color: '#E8EAF2' },
  empty: { fontSize: 13, color: '#8A90A6' },
};
