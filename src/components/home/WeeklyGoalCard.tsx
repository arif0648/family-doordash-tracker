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
  const weekStart = useMemo(() => weekBoundary(now).start, [now]);
  const week = useMemo(() => weekBoundary(now), [now]);
  const vehicleProgress = useMemo(
    () => computeVehicleGoalProgress({ income, vehicles, goals, boundary: week }),
    [income, vehicles, goals, week]
  );
  const familyGoal = vehicleProgress.reduce((sum, vehicle) => sum + vehicle.target, 0);
  const familyIncome = vehicleProgress.reduce((sum, vehicle) => sum + vehicle.amount, 0);
  const familyRemaining = Math.max(familyGoal - familyIncome, 0);
  const familyPercent = familyGoal > 0 ? Math.min((familyIncome / familyGoal) * 100, 100) : 0;
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
    <section className="home-glass" style={S.section}>
      <div style={S.head}>
        <div>
          <span style={S.kicker}>Haftalık Hedef</span>
          <h2 style={S.title}>{formatMoney(familyIncome, true)} / {formatMoney(familyGoal, true)}</h2>
          <span style={S.percentText}>%{familyPercent.toFixed(0)} tamamlandı</span>
        </div>
        <div style={S.badge}>{familyPercent >= 100 ? 'Hedef tamamlandı' : `${formatMoney(familyRemaining, true)} kaldı`}</div>
      </div>

      <div style={S.track}>
        <div style={{ ...S.fill, width: `${familyPercent}%` }} />
      </div>

      <div style={S.divider} />
      <div style={S.vehicleHead}><span style={S.vehicleTitle}>Araç hedefleri</span></div>

      <div style={S.vehicleList}>
        {vehicleProgress.map((vehicle) => (
          <div key={vehicle.vehicleId} style={S.vehicleRow}>
            <div style={S.vehicleTopline}>
              <strong style={S.vehicleName}>{vehicle.shortName}</strong>
              <span style={S.vehicleAmounts}>{formatMoney(vehicle.amount, true)} yapıldı · {formatMoney(vehicle.remaining, true)} kaldı</span>
              <span style={S.vehiclePct}>%{vehicle.percent}</span>
            </div>
            <div style={S.vehicleTrack}>
              <div style={{ ...S.vehicleFill, width: `${vehicle.percent}%` }} />
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: { padding: 15, borderRadius: 'var(--radius-card)', marginBottom: 14, color: 'var(--text)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  kicker: { fontSize: 11, letterSpacing: .2, color: 'var(--text-secondary)', fontWeight: 700 },
  title: { fontSize: 20, fontWeight: 780, margin: '3px 0 1px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' },
  percentText: { fontSize: 10, color: 'var(--text-secondary)', fontWeight: 650 },
  badge: { padding: '5px 8px', borderRadius: 10, background: 'rgba(66,209,131,.08)', color: '#86e6b3', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid rgba(66,209,131,.14)' },
  track: { position: 'relative', height: 6, borderRadius: 12, background: 'rgba(255,255,255,.055)', overflow: 'hidden', marginBottom: 4 },
  fill: { height: '100%', borderRadius: 12, background: 'linear-gradient(90deg, var(--positive), var(--accent))', transition: 'width 0.6s ease' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 },
  summaryItem: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, padding: 9, borderRadius: 12, background: 'var(--surface-raised)', fontSize: 10, color: 'var(--text-secondary)' },
  divider: { height: 1, background: 'var(--border)', margin: '10px 0 8px' },
  vehicleHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 },
  vehicleTitle: { fontSize: 9, fontWeight: 750, letterSpacing: .7, color: 'var(--text-secondary)' },
  vehicleList: { display: 'flex', flexDirection: 'column', gap: 4 },
  vehicleRow: { padding: '6px 7px', borderRadius: 10, background: 'rgba(255,255,255,.022)' },
  vehicleTopline: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  vehicleName: { minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text)', fontWeight: 700 },
  vehiclePct: { width: 29, textAlign: 'right', fontSize: 10, fontWeight: 750, color: 'var(--positive)', fontVariantNumeric: 'tabular-nums' },
  vehicleAmounts: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 9.5, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  vehicleTrack: { height: 3, marginTop: 5, borderRadius: 999, background: 'rgba(255,255,255,.055)', overflow: 'hidden' },
  vehicleFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accent), var(--positive))', transition: 'width 0.45s ease' },
  milestoneText: { marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' },
};
