import React, { useEffect, useMemo, useRef } from 'react';
import { WeeklyGoalRow } from '../../types/database';
import { playCelebrationSound } from '../../lib/sound';
import { weekBoundary } from '../../lib/timezone';

interface WeeklyGoalCardProps {
  goals: WeeklyGoalRow[];
  userId: string;
}

const MILESTONES = [25, 50, 75, 100];

function percentLabel(value: number, max: number): number {
  return max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
}

export function WeeklyGoalCard({ goals, userId }: WeeklyGoalCardProps) {
  const familyGoal = goals.reduce((s, g) => s + (Number(g.weekly_goal) || 0), 0);
  const familyIncome = goals.reduce((s, g) => s + (Number(g.week_income) || 0), 0);
  const familyRemaining = Math.max(familyGoal - familyIncome, 0);
  const familyPercent = familyGoal > 0 ? Math.min((familyIncome / familyGoal) * 100, 100) : 0;

  const nextMilestone = MILESTONES.find((m) => m > familyPercent) ?? 100;
  const prevMilestone = MILESTONES.filter((m) => m <= familyPercent).pop() ?? 0;

  const weekStart = useMemo(() => weekBoundary(new Date()).start, []);
  const celebratedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const storageKey = `barbin-weekly-goal-milestones-${weekStart}`;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          (JSON.parse(raw) as number[]).forEach((m) => celebratedRef.current.add(m));
        }
      }
    } catch {
      // localStorage yoksa sessizce devam et
    }

    MILESTONES.forEach((milestone) => {
      if (familyPercent >= milestone && !celebratedRef.current.has(milestone)) {
        celebratedRef.current.add(milestone);
        playCelebrationSound();
      }
    });

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify([...celebratedRef.current]));
      }
    } catch {
      // ignore
    }
  }, [familyPercent, weekStart]);

  const sorted = [...goals].sort((a, b) => (b.percent || 0) - (a.percent || 0));

  return (
    <section style={S.section}>
      <div style={S.head}>
        <div>
          <span style={S.kicker}>🎯 HAFTALIK AİLE HEDEFİ</span>
          <h2 style={S.title}>%{familyPercent.toFixed(0)} Tamamlandı</h2>
        </div>
        <div style={S.badge}>
          {familyPercent >= 100 ? '🏆 HEDEF!' : `$${familyRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} kaldı`}
        </div>
      </div>

      <div style={S.track}>
        <div style={{ ...S.fill, width: `${familyPercent}%` }} />
        <div style={S.milestones}>
          {MILESTONES.map((m) => (
            <div key={m} style={{ ...S.dot, background: familyPercent >= m ? 'var(--positive)' : 'var(--surface-raised)' }}>
              <span style={S.dotLabel}>{m}%</span>
            </div>
          ))}
        </div>
      </div>

      <div style={S.row}>
        <div style={S.stat}>
          <span>Aile Hedefi</span>
          <b>${familyGoal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
        </div>
        <div style={S.stat}>
          <span>Toplam Kazanç</span>
          <b>${familyIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
        </div>
        <div style={S.stat}>
          <span>Kalan</span>
          <b>${familyRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
        </div>
      </div>

      <h3 style={S.membersTitle}>Aile Üyeleri</h3>
      <div style={S.list}>
        {sorted.map((g) => {
          const isMe = g.user_id === userId;
          const p = percentLabel(g.week_income, g.weekly_goal);
          return (
            <div key={g.user_id} style={{ ...S.member, background: isMe ? 'rgba(139,92,246,.12)' : 'var(--surface-raised)' }}>
              <div style={S.memberInfo}>
                <strong>{g.display_name} {isMe && '(Sen)'}</strong>
                <span>${g.week_income.toLocaleString('en-US', { minimumFractionDigits: 2 })} / ${g.weekly_goal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={S.memberRight}>
                <b style={S.memberPercent}>%{p}</b>
                <div style={S.memberBar}>
                  <div style={{ ...S.memberFill, width: `${p}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={S.milestoneText}>
        {familyPercent >= 100 ? (
          <span>🎉 Tebrikler! Aile hedefine ulaştınız.</span>
        ) : (
          <span>Sonraki kilometre taşı: <strong>%{nextMilestone}</strong> ({prevMilestone}% tamamlandı)</span>
        )}
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
    color: 'var(--text)',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'var(--positive)',
    fontWeight: 900,
  },
  title: {
    fontSize: 18,
    fontWeight: 900,
    margin: '4px 0 0',
    color: 'var(--text)',
  },
  badge: {
    padding: '6px 10px',
    borderRadius: 10,
    background: 'rgba(34,197,94,.12)',
    color: 'var(--positive)',
    fontSize: 12,
    fontWeight: 800,
  },
  track: {
    position: 'relative',
    height: 22,
    borderRadius: 12,
    background: 'var(--surface-raised)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  fill: {
    height: '100%',
    borderRadius: 12,
    background: 'linear-gradient(90deg, var(--positive), var(--accent))',
    transition: 'width 0.6s ease',
  },
  milestones: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 6px',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'relative',
  },
  dotLabel: {
    position: 'absolute',
    top: 18,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 9,
    color: 'var(--text-secondary)',
    fontWeight: 800,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginBottom: 10,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 10,
    borderRadius: 12,
    background: 'var(--surface-raised)',
    fontSize: 11,
    color: 'var(--text-secondary)',
  },
  membersTitle: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    margin: '0 0 8px',
    fontWeight: 800,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 10,
  },
  member: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    border: '1px solid var(--border)',
  },
  memberInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  memberRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    minWidth: 80,
  },
  memberPercent: {
    fontSize: 15,
    color: 'var(--positive)',
  },
  memberBar: {
    width: 70,
    height: 6,
    borderRadius: 3,
    background: 'var(--surface)',
    overflow: 'hidden',
  },
  memberFill: {
    height: '100%',
    borderRadius: 3,
    background: 'var(--accent)',
    transition: 'width 0.5s ease',
  },
  milestoneText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
};
