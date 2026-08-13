import React from 'react';
import { VehicleSummary } from '../../lib/financialEngine';

export function VehicleComparison({ summaries }: { summaries: VehicleSummary[] }) {
  const max = Math.max(...summaries.map((s) => Math.abs(s.net)), 1);
  return (
    <section style={S.section}>
      <h2 style={S.title}>Araç Karşılaştırma</h2>
      <div style={S.list}>
        {summaries.map((s) => {
          const pct = (Math.abs(s.net) / max) * 100;
          return (
            <div key={s.vehicleId} style={S.row}>
              <div style={S.name}>{s.shortName}</div>
              <div style={S.barTrack}>
                <div style={{ ...S.barFill, width: `${pct}%` }} />
              </div>
              <div style={{ ...S.value, color: s.net >= 0 ? '#10B981' : '#F43F5E' }}>
                {s.net >= 0 ? '' : '−'}${Math.abs(s.net).toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: { padding: 16, borderRadius: 22, background: 'linear-gradient(145deg, rgba(20,25,38,.96), rgba(7,9,21,.98))', border: '1px solid rgba(255,255,255,.07)', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: 900, margin: '0 0 14px' },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'grid', gridTemplateColumns: '100px 1fr 70px', alignItems: 'center', gap: 10 },
  name: { fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' },
  barTrack: { height: 10, borderRadius: 5, background: 'rgba(255,255,255,.06)' },
  barFill: { height: '100%', borderRadius: 5, background: 'linear-gradient(90deg, #F43F5E, #FB7185)' },
  value: { fontSize: 13, fontWeight: 900, textAlign: 'right' },
};
