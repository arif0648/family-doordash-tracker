import React from 'react';
import { VehicleSummary } from '../../lib/financialEngine';

export function VehicleCard({
  shortName,
  summary,
  showFixedShare,
}: {
  shortName: string;
  summary: VehicleSummary;
  showFixedShare: boolean;
}) {
  const netColor = summary.net >= 0 ? '#A855F7' : '#F87171';
  const netSign = summary.net >= 0 ? '+' : '';

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <p style={styles.name}>{shortName}</p>
        <p style={{ ...styles.net, color: netColor }}>
          {netSign}${Math.abs(summary.net).toLocaleString('en-US')}
        </p>
      </div>
      <div style={styles.row}>
        <Metric label="Kazanç" value={summary.income} positive />
        <Metric label="Benzin" value={-summary.gas} />
        <Metric label="Araç Gideri" value={-summary.vehicleExpense} />
        {showFixedShare && <Metric label="Sabit Pay" value={-summary.fixedShare} />}
      </div>
      <p style={styles.mileage}>{summary.milesDriven.toLocaleString('en-US')} mi</p>
    </div>
  );
}

function Metric({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  const color = positive ? '#A855F7' : value < 0 ? '#F87171' : '#A7ABC0';
  const sign = value > 0 ? '+' : '';
  return (
    <div>
      <p style={styles.metricLabel}>{label}</p>
      <p style={{ ...styles.metricValue, color }}>
        {sign}${Math.abs(value).toLocaleString('en-US')}
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: '#120E2A', borderRadius: 16, padding: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  name: { fontSize: 15, fontWeight: 700, margin: 0 },
  net: { fontSize: 18, fontWeight: 800, margin: 0 },
  row: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  metricLabel: { fontSize: 11, color: '#7F8499', margin: 0 },
  metricValue: { fontSize: 14, fontWeight: 600, margin: 0 },
  mileage: { fontSize: 12, color: '#7F8499', marginTop: 10, marginBottom: 0 },
};
