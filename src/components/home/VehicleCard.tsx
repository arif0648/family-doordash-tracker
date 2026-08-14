import React from 'react';
import { Vehicle } from '../../types/database';
import { VehicleSummary } from '../../lib/financialEngine';

const FUEL_EFFICIENCY: Record<string, number> = {
  Hybrid: 50,
  Electric: 120,
  Gasoline: 32,
  Diesel: 38,
};

export function VehicleCard({ vehicle, summary }: { vehicle: Vehicle; summary: VehicleSummary }) {
  const mpg = FUEL_EFFICIENCY[vehicle.fuel_type || ''] ?? 32;
  const isPositive = summary.net >= 0;

  return (
    <div style={{ ...S.card, borderColor: isPositive ? 'rgba(16,185,129,.25)' : 'rgba(244,63,94,.25)' }}>
      <div style={S.top}>
        <div style={S.icon}>◇</div>
        <div style={S.header}>
          <h3 style={S.title}>{vehicle.year} {vehicle.make} {vehicle.model}</h3>
          <p style={S.sub}>Yakıt Verimi: {mpg} MPG</p>
        </div>
      </div>
      <div style={S.divider} />
      <div style={S.row}>
        <span style={S.label}>Toplam Mil</span>
        <span style={S.value}>{summary.milesDriven.toLocaleString('en-US')} mi</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>Toplam Gelir</span>
        <span style={{ ...S.value, color: '#10B981' }}>${summary.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
      <div style={S.row}>
        <span style={S.label}>Net</span>
        <span style={{ ...S.value, color: isPositive ? '#10B981' : '#F43F5E' }}>
          {isPositive ? '' : '−'}${Math.abs(summary.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { padding: 12, borderRadius: 15, background: 'rgba(255,255,255,.018)', border: '1px solid' },
  top: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 },
  icon: { width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'rgba(60,200,237,.07)', color:'var(--accent)', fontSize: 18 },
  header: { flex: 1 },
  title: { fontSize: 14, fontWeight: 750, margin: 0 },
  sub: { fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0', fontWeight: 650 },
  divider: { height: 1, background: 'var(--border)', marginBottom: 9 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  label: { fontSize: 11, color: 'var(--muted)' },
  value: { fontSize: 13, fontWeight: 750, color: 'var(--text)' },
};
