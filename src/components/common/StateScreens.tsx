import React from 'react';

export function LoadingScreen({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <div style={styles.center} role="status">
      <div style={styles.spinner} />
      <p style={styles.label}>{label}</p>
    </div>
  );
}

export function ErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div style={styles.center}>
      <div style={styles.stateIcon}>!</div>
      <p style={styles.errorMessage}>{message}</p>
      {onRetry && (
        <button style={styles.retryButton} onClick={onRetry}>
          Tekrar Dene
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  message = 'Henüz veri yok',
  icon = '·',
}: {
  message?: string;
  icon?: string;
}) {
  return (
    <div style={styles.center}>
      <div style={styles.stateIcon}>{icon}</div>
      <p style={styles.emptyMessage}>{message}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '28px 16px',
    textAlign: 'center',
    gap: 8,
  },
  spinner: {
    width: 24,
    height: 24,
    border: '2px solid rgba(255,255,255,.1)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  label: { fontSize: 14, color: '#94A3B8' },
  errorMessage: { fontSize: 14, color: '#F87171', maxWidth: 320 },
  emptyMessage: { fontSize: 13, color: 'var(--muted)' },
  stateIcon: { width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,.025)', color: 'var(--text-secondary)', fontSize: 16, fontWeight: 750 },
  retryButton: {
    marginTop: 8,
    padding: '10px 24px',
    borderRadius: 12,
    border: '1px solid rgba(60,200,237,.2)',
    background: 'rgba(60,200,237,.1)',
    color: '#bdeafa',
    fontWeight: 700,
    fontSize: 14,
  },
};
