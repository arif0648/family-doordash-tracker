import React, { useEffect, useMemo, useRef } from 'react';
import { Vehicle, WeeklyGoalRow } from '../../types/database';
import { IncomeRecord, computeVehicleGoalProgress } from '../../lib/financialEngine';
import { playCelebrationSound } from '../../lib/sound';
import { weekBoundary } from '../../lib/timezone';
import { formatMoney } from '../../lib/format';

interface WeeklyGoalCardProps {
  goals: WeeklyGoalRow[];
  income: IncomeRecord[];
  vehicles: Vehicle[];
  now: Date;
}

const MILESTONES = [25, 50, 75, 100];

export function WeeklyGoalCard({ goals, income, vehicles, now }: WeeklyGoalCardProps) {
  const familyGoal = goals.reduce((s, g) => s + (Number(g.weekly_goal) || 0), 0);
  const familyIncome = goals.reduce((s, g) => s + (Number(g.week_income) || 0), 0);
  const familyRemaining = Math.max(familyGoal - familyIncome, 0);
  const familyPercent = familyGoal > 0 ? Math.min((familyIncome / familyGoal) * 100, 100) : 0;

  const nextMilestone = MILESTONES.find((m) => m > familyPercent) ?? 100;
  const prevMilestone = MILESTONES.filter((m) => m <= familyPercent).pop() ?? 0;
  const weekStart = useMemo(() => weekBoundary(now).start, [now]);
  const week = useMemo(() => weekBoundary(now), [now]);
  const vehicleProgress = useMemo(
    () => computeVehicleGoalProgress({ income, vehicles, goals, boundary: week }),
    [income, vehicles, goals, week]
  );
  const celebratedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const storageKey = `barbin-weekly-goal-milestones-${weekStart}`;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(storageKey);
        if (raw) (JSON.parse(raw) as number[]).forEach((m) => celebratedRef.current.add(m));
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

  return (
    <section style={S.section}>
      <div style={S.head}>
        <div>
          <span style={S.kicker}>🎯 HAFTALIK AİLE HEDEFİ</span>
          <h2 style={S.title}>{formatMoney(familyIncome, true)} / {formatMoney(familyGoal, true)}</h2>
          <span style={S.percentText}>%{familyPercent.toFixed(0)} tamamlandı</span>
        </div>
        <div style={S.badge}>
          {familyPercent >= 100 ? '🏆 HEDEF!' : `${formatMoney(familyRemaining, true)} kaldı`}
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

      <div style={S.summaryRow}>
        <div style={S.summaryItem}><span>Toplam hedef</span><b>{formatMoney(familyGoal, true)}</b></div>
        <div style={S.summaryItem}><span>Toplam gelir</span><b>{formatMoney(familyIncome, true)}</b></div>
        <div style={S.summaryItem}><span>Kalan</span><b>{formatMoney(familyRemaining, true)}</b></div>
      </div>

      <div style={S.divider} />
      <div style={S.vehicleHead}>
        <span style={S.vehicleTitle}>ARAÇ HEDEF İLERLEMESİ</span>
        <span style={S.vehicleHint}>Her araç kendi haftalık hedefinde</span>
      </div>

      <div style={S.vehicleList}>
        {vehicleProgress.map((vehicle) => (
          <div key={vehicle.vehicleId} style={S.vehicleRow}>
            <div style={S.vehicleTopline}>
              <strong style={S.vehicleName}>{vehicle.shortName}</strong>
              <span style={S.vehiclePct}>%{vehicle.percent}</span>
            </div>
            <div style={S.vehicleAmounts}>
              <span>{formatMoney(vehicle.amount, true)} / {formatMoney(vehicle.target, true)}</span>
              <span>{vehicle.remaining > 0 ? `${formatMoney(vehicle.remaining, true)} kaldı` : 'Hedef tamamlandı'}</span>
            </div>
            <div style={S.vehicleTrack}>
              <div style={{ ...S.vehicleFill, width: `${vehicle.percent}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div style={S.milestoneText}>
        {familyGoal <= 0 ? (
          <span>Haftalık hedef henüz belirlenmemiş.</span>
        ) : familyPercent >= 100 ? (
          <span>🎉 Tebrikler! Aile hedefine ulaştınız.</span>
        ) : (
          <span>Sonraki kilometre taşı: <strong>%{nextMilestone}</strong> ({prevMilestone}% tamamlandı)</span>
        )}
      </div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: { padding: 16, borderRadius: 'var(--radius-card)', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', marginBottom: 14, color: 'var(--text)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  kicker: { fontSize: 10, letterSpacing: 1.5, color: 'var(--positive)', fontWeight: 900 },
  title: { fontSize: 22, fontWeight: 900, margin: '5px 0 2px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' },
  percentText: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 800 },
  badge: { padding: '6px 9px', borderRadius: 10, background: 'rgba(34,197,94,.12)', color: 'var(--positive)', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' },
  track: { position: 'relative', height: 22, borderRadius: 12, background: 'var(--surface-raised)', overflow: 'hidden', marginBottom: 20 },
  fill: { height: '100%', borderRadius: 12, background: 'linear-gradient(90deg, var(--positive), var(--accent))', transition: 'width 0.6s ease' },
  milestones: { position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px' },
  dot: { width: 10, height: 10, borderRadius: 5, position: 'relative' },
  dotLabel: { position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'var(--text-secondary)', fontWeight: 800 },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 },
  summaryItem: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, padding: 9, borderRadius: 12, background: 'var(--surface-raised)', fontSize: 10, color: 'var(--text-secondary)' },
  divider: { height: 1, background: 'var(--border)', margin: '14px 0 12px' },
  vehicleHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 9 },
  vehicleTitle: { fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: 'var(--accent)' },
  vehicleHint: { fontSize: 9, color: 'var(--muted)', textAlign: 'right' },
  vehicleList: { display: 'flex', flexDirection: 'column', gap: 8 },
  vehicleRow: { padding: '9px 10px', borderRadius: 12, background: 'var(--surface-raised)', border: '1px solid var(--border)' },
  vehicleTopline: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  vehicleName: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text)' },
  vehiclePct: { fontSize: 13, fontWeight: 900, color: 'var(--positive)', fontVariantNumeric: 'tabular-nums' },
  vehicleAmounts: { display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 3, fontSize: 10, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' },
  vehicleTrack: { height: 6, marginTop: 7, borderRadius: 999, background: 'var(--surface)', overflow: 'hidden' },
  vehicleFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accent), var(--positive))', transition: 'width 0.45s ease' },
  milestoneText: { marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' },
};
