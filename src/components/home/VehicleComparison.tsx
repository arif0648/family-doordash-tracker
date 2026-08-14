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
              <div style={{ ...S.value, color: s.net >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
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
  section: { padding: 14, borderRadius: 17, background: '#101823', border: '1px solid var(--border)', marginBottom: 12, boxShadow:'var(--shadow-card)' },
  title: { fontSize: 14, fontWeight: 750, margin: '0 0 11px' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: { display: 'grid', gridTemplateColumns: '100px 1fr 70px', alignItems: 'center', gap: 10 },
  name: { fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' },
  barTrack: { height: 10, borderRadius: 5, background: 'rgba(255,255,255,.06)' },
  barFill: { height: '100%', borderRadius: 5, background: 'linear-gradient(90deg, var(--accent), var(--positive))' },
  value: { fontSize: 13, fontWeight: 900, textAlign: 'right' },
};
