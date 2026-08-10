import React from 'react';

export function LoadingScreen({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <div style={styles.center}>
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
      <div style={{ fontSize: 32 }}>⚠️</div>
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
  icon = '📭',
}: {
  message?: string;
  icon?: string;
}) {
  return (
    <div style={styles.center}>
      <div style={{ fontSize: 32 }}>{icon}</div>
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
    padding: '40px 16px',
    textAlign: 'center',
    gap: 8,
  },
  spinner: {
    width: 28,
    height: 28,
    border: '3px solid #2A2F3A',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  label: { fontSize: 14, color: '#94A3B8' },
  errorMessage: { fontSize: 14, color: '#F87171', maxWidth: 320 },
  emptyMessage: { fontSize: 14, color: '#64748B' },
  retryButton: {
    marginTop: 8,
    padding: '10px 24px',
    borderRadius: 12,
    border: 'none',
    background: '#22C55E',
    color: 'white',
    fontWeight: 600,
    fontSize: 14,
  },
};
