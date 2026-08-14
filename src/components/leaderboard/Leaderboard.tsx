import React from 'react';
import { computeLeaderboard, VehicleSummary } from '../../lib/financialEngine';
import { EmptyState } from '../common/StateScreens';

const MEDALS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export function Leaderboard({
  title,
  vehicleSummaries,
  hasAnyRealActivity,
}: {
  title: string;
  vehicleSummaries: VehicleSummary[];
  hasAnyRealActivity: boolean;
}) {
  const result = computeLeaderboard({ vehicleSummaries, hasAnyRealActivity });

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <span style={styles.kicker}>ARAÇ PERFORMANSI</span>
        <h3 style={styles.title}>{title}</h3>
      </div>
      {!result.hasData ? (
        <EmptyState message="Henüz veri yok" icon="·" />
      ) : (
        <div style={styles.list}>
          {result.ranking.map((entry, idx) => {
            const positive = entry.net >= 0;
            const top3 = idx < 3;
            return (
              <div key={entry.vehicleId} style={{ ...styles.row, background: top3 ? 'rgba(255,255,255,.025)' : 'transparent', borderColor: 'var(--border)' }}>
                <div style={{ ...styles.rank, background: 'rgba(255,255,255,.035)', color: top3 ? 'var(--gold)' : 'var(--text-secondary)' }}>
                  {MEDALS[idx] ?? idx + 1}
                </div>
                <div style={styles.info}>
                  <div style={styles.name}>{entry.shortName}</div>
                </div>
                <div style={{ ...styles.net, color: positive ? 'var(--positive)' : 'var(--negative)' }}>
                  {positive ? '+' : '−'}${Math.abs(entry.net).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { background: 'linear-gradient(145deg,#111a26,#0a1018)', borderRadius: 18, padding: 15, marginBottom: 12, border: '1px solid var(--border)', boxShadow:'var(--shadow-card)' },
  head: { marginBottom: 12 },
  kicker: { fontSize: 9, letterSpacing: 1.4, color: 'var(--text-secondary)', fontWeight: 750 },
  title: { fontSize: 18, fontWeight: 800, margin: '4px 0 0', color: '#fff' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, border: '1px solid', transition: 'transform .15s, background .15s' },
  rank: { width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 900, flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: 800, color: '#fff' },
  net: { fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap' },
};
