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
        <div style={S.icon}>🚗</div>
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
  card: { padding: 18, borderRadius: 22, background: 'linear-gradient(145deg, rgba(20,25,38,.96), rgba(7,9,21,.98))', border: '1px solid', boxShadow: '0 18px 45px rgba(0,0,0,.35)' },
  top: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 },
  icon: { width: 50, height: 50, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(56,189,248,.12)', fontSize: 26 },
  header: { flex: 1 },
  title: { fontSize: 16, fontWeight: 900, margin: 0 },
  sub: { fontSize: 13, color: '#10B981', margin: '4px 0 0', fontWeight: 700 },
  divider: { height: 1, background: 'rgba(255,255,255,.06)', marginBottom: 14 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, color: '#8A90A6' },
  value: { fontSize: 15, fontWeight: 800, color: '#E8EAF2' },
};
