import React from 'react';
import { formatMoney } from '../../lib/format';

interface FamilyStatusProps {
  net: number;
}

export function FamilyStatus({ net }: FamilyStatusProps) {
  const positive = net >= 0;
  const abs = Math.abs(net);

  return (
    <section style={S.section}>
      <div style={S.kicker}>AİLE MALİ DURUMU</div>
      <div style={{ ...S.row, color: positive ? 'var(--positive)' : 'var(--negative)' }}>
        <span style={S.arrow}>{positive ? '↑' : '↓'}</span>
        <span style={S.status}>{positive ? 'ARTIDAYIZ' : 'EKSİDEYİZ'}</span>
      </div>
      <p style={S.text}>
        {positive
          ? `Bu ay takip edilen gelirler giderlerin üzerinde (${formatMoney(abs)}).`
          : `Bu ay takip edilen giderler geliri ${formatMoney(abs)} aşıyor.`}
      </p>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: {
    padding: 16,
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-card)',
    marginBottom: 14,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: 900,
    color: 'var(--text-secondary)',
    marginBottom: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  arrow: {
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1,
  },
  status: {
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: -0.5,
  },
  text: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
};
