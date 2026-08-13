import { CreditCardRow } from '../types/database';

export interface CreditCardStatus {
  label: string;
  badge: string;
  glow: string;
  accent: string;
  order: number;
}

function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const d = new Date(`${dueDate}T00:00:00`);
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - n.getTime()) / 86400000);
}

const STATUSES: Record<string, CreditCardStatus> = {
  PAID: { label: 'ÖDENDİ', badge: 'rgba(52,211,153,.16)', glow: 'rgba(52,211,153,.25)', accent: '#34D399', order: 5 },
  UNPAID: { label: 'ÖDENMEDİ', badge: 'rgba(168,85,247,.16)', glow: 'rgba(168,85,247,.25)', accent: '#C084FC', order: 3 },
  DUE_SOON: { label: 'YAKLAŞIYOR', badge: 'rgba(59,130,246,.16)', glow: 'rgba(59,130,246,.25)', accent: '#60A5FA', order: 2 },
  URGENT: { label: 'ACİL', badge: 'rgba(245,158,11,.16)', glow: 'rgba(245,158,11,.35)', accent: '#FBBF24', order: 1 },
  OVERDUE: { label: 'VADESİ GEÇTİ', badge: 'rgba(220,38,38,.18)', glow: 'rgba(220,38,38,.35)', accent: '#FDA4AF', order: 0 },
};

export function computeCreditCardStatus(card: CreditCardRow): CreditCardStatus & { days: number | null } {
  const balance = Number(card.current_balance || 0);
  const days = daysUntil(card.due_date);

  if (balance <= 0) {
    return { ...STATUSES.PAID, days };
  }
  if (days === null) {
    return { ...STATUSES.UNPAID, days };
  }
  if (days < 0) {
    return { ...STATUSES.OVERDUE, days };
  }
  if (days <= 3) {
    return { ...STATUSES.URGENT, days };
  }
  if (days <= 7) {
    return { ...STATUSES.DUE_SOON, days };
  }
  return { ...STATUSES.UNPAID, days };
}
