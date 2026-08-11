import React from 'react';
import { colors, glassCard, radius, type } from '../../theme/theme';

export interface CreditCardDue {
  id: string;
  cardLabel: string; // "Chase Sapphire"
  amount: number;
  dueInDays: number;
  paid: boolean;
}

interface CreditCardAlertProps {
  cards: CreditCardDue[];
  onMarkPaid: (id: string) => void;
}

/**
 * "Yaklaşan kredi kartı ödemesi" uyarı kartı/kartları.
 *
 * VERİ KAYNAĞI HENÜZ BAĞLI DEĞİL: bu bileşen tamamen sunum katmanı —
 * `cards` prop'unu, 0012_family_notifications.sql üzerindeki strict
 * privacy kuralına uyan bir sorgudan (yalnızca kart sahibine gösterilecek
 * şekilde) sen dolduracaksın. `onMarkPaid` da gerçek update/RPC çağrısını
 * yapacak fonksiyonun olmalı — örnek:
 *
 *   await supabase.from('credit_card_payments')
 *     .update({ paid: true })
 *     .eq('id', cardId);
 *
 * (Tablo/sütun adları varsayımdır, gerçek şemana göre uyarlaman gerekir.)
 */
export function CreditCardAlert({ cards, onMarkPaid }: CreditCardAlertProps) {
  const unpaid = cards.filter((c) => !c.paid);
  if (unpaid.length === 0) return null;

  return (
    <div style={styles.stack}>
      {unpaid.map((card) => (
        <div key={card.id} style={{ ...glassCard(), padding: 16, borderLeft: `3px solid ${colors.cyan}` }}>
          <div style={styles.headerRow}>
            <span style={{ ...type.eyebrow, color: colors.cyan }}>KREDİ KARTI ÖDEMESİ</span>
            <span style={styles.dueBadge}>
              Ödemeye {card.dueInDays} gün kaldı
            </span>
          </div>
          <p style={{ ...type.body, fontWeight: 700, marginTop: 8, marginBottom: 0 }}>{card.cardLabel}</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary, margin: '4px 0 12px' }}>
            ${card.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <button type="button" style={styles.markPaidButton} onClick={() => onMarkPaid(card.id)}>
            ÖDEMEYİ İŞARETLE
          </button>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  stack: { display: 'flex', flexDirection: 'column', gap: 10 },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  dueBadge: { ...type.caption, color: colors.textSecondary },
  markPaidButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: radius.sm,
    border: `1px solid ${colors.cyan}`,
    background: 'transparent',
    color: colors.cyan,
    fontWeight: 800,
    fontSize: 12.5,
    letterSpacing: 0.3,
    cursor: 'pointer',
  },
};
