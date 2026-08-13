import React from 'react';
import { WeeklyGoalRow } from '../../types/database';

interface WeeklyGoalBarProps {
  goals: WeeklyGoalRow[];
}

export function WeeklyGoalBar({ goals }: WeeklyGoalBarProps) {
  const familyGoal = goals.reduce((s, g) => s + (Number(g.weekly_goal) || 0), 0);
  const familyIncome = goals.reduce((s, g) => s + (Number(g.week_income) || 0), 0);
  const percent = familyGoal > 0 ? Math.min((familyIncome / familyGoal) * 100, 100) : 0;
  const remaining = Math.max(familyGoal - familyIncome, 0);

  return (
    <div style={S.wrap}>
      <div style={S.track}>
        <div style={{ ...S.fill, width: `${percent}%` }} />
      </div>
      <div style={S.text}>
        <b>%{percent.toFixed(0)}</b>
        <span>${familyIncome.toLocaleString('en-US')} / ${familyGoal.toLocaleString('en-US')}</span>
        <span>${remaining.toLocaleString('en-US')} kaldı</span>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { padding: 12, borderRadius: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', marginBottom: 10 },
  track: { height: 8, borderRadius: 8, background: 'rgba(255,255,255,.06)', overflow: 'hidden', marginBottom: 8 },
  fill: { height: '100%', borderRadius: 8, background: 'linear-gradient(90deg, #34D399, #60A5FA)' },
  text: { display: 'flex', gap: 10, fontSize: 12, color: '#9CA3AF' },
};
