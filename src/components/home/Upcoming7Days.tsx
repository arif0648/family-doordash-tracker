import React from 'react';
import { NavLink } from 'react-router-dom';
import { CreditCardRow, FixedExpenseRow, AppointmentRow } from '../../types/database';

function daysUntil(date: string): number {
  const d = new Date(`${date}T00:00:00`);
  const n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - n.getTime()) / 86400000);
}

interface Upcoming7DaysProps {
  creditCards: CreditCardRow[];
  fixedExpenses: FixedExpenseRow[];
  appointments: AppointmentRow[];
  onPay?: (cardId: string) => void;
}

export function Upcoming7Days({ creditCards, fixedExpenses, appointments, onPay }: Upcoming7DaysProps) {
  const activeFixed = fixedExpenses.filter((f) => !f.effective_to);
  const items: { id: string; date: string; label: string; amount: number | null; type: 'card' | 'fixed' | 'appointment'; cardId?: string }[] = [];

  creditCards.forEach((c) => {
    if (c.due_date) items.push({ id: c.id, date: c.due_date, label: `${c.card_name} — asgari`, amount: c.minimum_payment ? Number(c.minimum_payment) : Number(c.current_balance), type: 'card', cardId: c.id });
  });
  activeFixed.forEach((f) => {
    items.push({ id: f.id, date: f.effective_from, label: f.label, amount: Number(f.monthly_amount), type: 'fixed' });
  });
  appointments.forEach((a) => {
    if (a.status !== 'cancelled' && a.start_at) items.push({ id: a.id, date: a.start_at.slice(0, 10), label: a.title, amount: null, type: 'appointment' });
  });

  const upcoming = items
    .map((i) => ({ ...i, days: daysUntil(i.date) }))
    .filter((i) => i.days >= 0 && i.days <= 7)
    .sort((a, b) => a.days - b.days);

  const total = upcoming.reduce((s, i) => s + (i.amount || 0), 0);

  if (upcoming.length === 0) return null;

  return (
    <section style={S.section}>
      <div style={S.head}>
        <div>
          <span style={S.kicker}>YAKLAŞAN 7 GÜN</span>
        </div>
        <strong style={S.total}>${total.toLocaleString('en-US')}</strong>
      </div>
      <div style={S.list}>
        {upcoming.map((i) => (
          <div key={i.id} style={S.row}>
            <span style={{ ...S.dot, background: i.type === 'card' ? '#F43F5E' : i.type === 'fixed' ? '#F59E0B' : '#38BDF8' }} />
            <div style={S.meta}>
              <strong>{new Date(`${i.date}T00:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</strong>
              <span>{i.label}</span>
            </div>
            <div style={S.right}>
              {i.amount !== null && <b>${i.amount.toLocaleString('en-US')}</b>}
              {i.type === 'card' && onPay && (
                <button onClick={() => onPay(i.cardId!)} style={S.payBtn}>Öde</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <NavLink to="/randevular" style={S.link}>Tümünü Gör ›</NavLink>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: { padding: 14, borderRadius: 18, background: 'linear-gradient(145deg,#111a26,#0a1018)', border: '1px solid var(--border)', boxShadow:'var(--shadow-card)', marginBottom: 10 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  kicker: { fontSize: 9, letterSpacing: 2, color: '#9C8BEF', fontWeight: 900 },
  total: { fontSize: 16, color: '#FDA4AF' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,.05)' },
  dot: { width: 8, height: 8, borderRadius: 999 },
  meta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  right: { display: 'flex', alignItems: 'center', gap: 8 },
  payBtn: { border: 0, borderRadius: 8, padding: '4px 8px', background: 'rgba(52,211,153,.15)', color: '#34D399', fontWeight: 800, fontSize: 11 },
  link: { display: 'block', textAlign: 'right', fontSize: 11, color: '#C084FC', textDecoration: 'none', marginTop: 8 },
};
