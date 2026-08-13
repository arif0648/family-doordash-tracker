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
            <div key={m} style={{ ...S.dot, background: familyPercent >= m ? '#34D399' : 'rgba(255,255,255,.16)' }}>
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
            <div key={g.user_id} style={{ ...S.member, background: isMe ? 'rgba(168,85,247,.12)' : 'rgba(255,255,255,.04)' }}>
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
    padding: 14,
    borderRadius: 18,
    background: 'linear-gradient(145deg, rgba(25,18,56,.96), rgba(7,9,21,.98))',
    border: '1px solid rgba(52,211,153,.18)',
    boxShadow: '0 16px 40px rgba(0,0,0,.35)',
    marginBottom: 8,
    color: '#fff',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  kicker: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#9C8BEF',
    fontWeight: 900,
  },
  title: {
    fontSize: 18,
    fontWeight: 900,
    margin: '4px 0 0',
  },
  badge: {
    padding: '6px 10px',
    borderRadius: 10,
    background: 'rgba(52,211,153,.12)',
    color: '#34D399',
    fontSize: 12,
    fontWeight: 800,
  },
  track: {
    position: 'relative',
    height: 22,
    borderRadius: 12,
    background: 'rgba(255,255,255,.06)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  fill: {
    height: '100%',
    borderRadius: 12,
    background: 'linear-gradient(90deg, #34D399, #A78BFA)',
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
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 9,
    color: '#9CA3AF',
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
    background: 'rgba(255,255,255,.04)',
  },
  membersTitle: {
    fontSize: 11,
    color: '#9CA3AF',
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
    border: '1px solid rgba(255,255,255,.06)',
  },
  memberInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
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
    color: '#34D399',
  },
  memberBar: {
    width: 70,
    height: 6,
    borderRadius: 3,
    background: 'rgba(255,255,255,.1)',
    overflow: 'hidden',
  },
  memberFill: {
    height: '100%',
    borderRadius: 3,
    background: '#60A5FA',
    transition: 'width 0.5s ease',
  },
  milestoneText: {
    fontSize: 13,
    color: '#C7CAD6',
    textAlign: 'center',
  },
};
