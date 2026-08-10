import React from 'react';
import { computeLeaderboard, VehicleSummary } from '../../lib/financialEngine';
import { EmptyState } from '../common/StateScreens';

export function Leaderboard({
  title,
  vehicleSummaries,
  vehicleNames,
  hasAnyRealActivity,
}: {
  title: string;
  vehicleSummaries: VehicleSummary[];
  vehicleNames: Record<string, string>;
  hasAnyRealActivity: boolean;
}) {
  const result = computeLeaderboard({ vehicleSummaries, hasAnyRealActivity });

  return (
    <div style={styles.card}>
      <p style={styles.title}>{title}</p>
      {!result.hasData ? (
        <EmptyState message="Henüz veri yok" icon="🏆" />
      ) : (
        <div style={styles.ranking}>
          {result.ranking.map((entry, idx) => (
            <div key={entry.vehicleId} style={styles.row}>
              <span style={styles.rank}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
              <span style={styles.name}>{vehicleNames[entry.vehicleId] ?? entry.vehicleId}</span>
              <span style={{ ...styles.net, color: entry.net >= 0 ? '#22C55E' : '#F87171' }}>
                {entry.net >= 0 ? '+' : ''}${Math.abs(entry.net).toLocaleString('en-US')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: '#151B2C', borderRadius: 16, padding: 16, marginBottom: 12 },
  title: { fontSize: 13, fontWeight: 700, color: '#94A3B8', marginBottom: 10 },
  ranking: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 10 },
  rank: { fontSize: 18 },
  name: { flex: 1, fontSize: 14, color: 'white' },
  net: { fontSize: 14, fontWeight: 700 },
};
