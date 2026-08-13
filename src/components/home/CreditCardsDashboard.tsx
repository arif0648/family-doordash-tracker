import React from 'react';
import { CreditCardRow } from '../../types/database';
import { NavLink } from 'react-router-dom';
import { computeCreditCardStatus } from '../../lib/creditCardStatus';

interface CreditCardsDashboardProps {
  cards: CreditCardRow[];
}

function formatDate(date: string | null): string {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' });
}

export function CreditCardsDashboard({ cards }: CreditCardsDashboardProps) {
  if (cards.length === 0) return null;

  const sorted = [...cards]
    .filter((c) => c.is_active !== false)
    .sort((a, b) => {
      const ua = computeCreditCardStatus(a).order;
      const ub = computeCreditCardStatus(b).order;
      if (ua !== ub) return ua - ub;
      const da = a.due_date ?? '9999-12-31';
      const db = b.due_date ?? '9999-12-31';
      return da.localeCompare(db);
    });

  const total = sorted.reduce((s, c) => s + Number(c.current_balance || 0), 0);
  const totalLimit = sorted.reduce((s, c) => s + Number(c.credit_limit || 0), 0);
  const utilization = totalLimit > 0 ? total / totalLimit : 0;

  return (
    <section style={S.section}>
      <div style={S.head}>
        <div>
          <span style={S.kicker}>💳 BORÇ ÖZETİ</span>
          <h2 style={S.title}>Kredi Kartları</h2>
        </div>
        <NavLink to="/kredi-kartlari" style={S.link}>Tümünü Yönet ›</NavLink>
      </div>

      <div style={S.overview}>
        <div>
          <div style={S.overviewLabel}>Toplam borç</div>
          <div style={S.overviewTotal}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        {totalLimit > 0 && (
          <div style={S.util}>
            <div style={S.utilBar}>
              <div style={{ ...S.utilFill, width: `${Math.min(utilization * 100, 100)}%`, background: utilization > .7 ? '#F87171' : utilization > .4 ? '#FBBF24' : '#34D399' }} />
            </div>
            <div style={S.utilLabel}>{(utilization * 100).toFixed(0)}% limit kullanımı</div>
          </div>
        )}
      </div>

      <div style={S.list}>
        {sorted.map((c) => {
          const { days, ...theme } = computeCreditCardStatus(c);
          const balance = Number(c.current_balance || 0);
          const limit = c.credit_limit ? Number(c.credit_limit) : 0;
          const minPay = c.minimum_payment ? Number(c.minimum_payment) : null;
          const stmt = c.statement_balance ? Number(c.statement_balance) : null;
          const pct = limit > 0 ? Math.min((balance / limit) * 100, 100) : 0;
          return (
            <div key={c.id} style={{ ...S.card, boxShadow: `inset 0 0 0 1px ${theme.glow}` }}>
              <div style={S.rowTop}>
                <div style={S.identity}>
                  <div style={S.cardName}>{c.card_name} {c.last_four ? <span style={S.last4}>•••• {c.last_four}</span> : null}</div>
                  <div style={S.meta}>
                    {c.due_date ? <span>{formatDate(c.due_date)} vade</span> : <span>Ödeme tarihi yok</span>}
                    {days !== null && (
                      <span style={{ ...S.badge, background: theme.badge, color: theme.accent }}>{days < 0 ? `${Math.abs(days)} gün gecikti` : days === 0 ? 'Bugün' : `${days} gün kaldı`}</span>
                    )}
                  </div>
                </div>
                <div style={{ ...S.balance, color: balance > 0 ? '#FDA4AF' : '#34D399' }}>
                  {balance > 0 ? `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Borç yok'}
                </div>
              </div>

              <div style={S.bars}>
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: `${pct}%`, background: pct > 70 ? '#F87171' : pct > 40 ? '#FBBF24' : '#34D399' }} />
                </div>
                <div style={S.barLabel}>{limit > 0 ? `${pct.toFixed(0)}% / $${limit.toLocaleString('en-US')} limit` : 'Limit tanımlı değil'}</div>
              </div>

              {(stmt || minPay) && (
                <div style={S.foot}>
                  {stmt ? <span>Dönem borcu <b>${stmt.toFixed(2)}</b></span> : null}
                  {minPay ? <span>Min. ödeme <b>${minPay.toFixed(2)}</b></span> : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: {
    padding: 16,
    borderRadius: 24,
    background: 'linear-gradient(145deg, rgba(25,18,56,.96), rgba(7,9,21,.98))',
    border: '1px solid rgba(168,85,247,.15)',
    boxShadow: '0 24px 65px rgba(0,0,0,.35)',
    marginBottom: 10,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  kicker: { fontSize: 9, letterSpacing: 2, color: '#9C8BEF', fontWeight: 900 },
  title: { fontSize: 18, fontWeight: 800, margin: '4px 0 0', color: '#fff' },
  link: { fontSize: 12, color: '#C084FC', textDecoration: 'none', fontWeight: 700 },
  overview: {
    padding: 16,
    borderRadius: 18,
    background: 'linear-gradient(135deg, rgba(168,85,247,.14), rgba(99,102,241,.08))',
    border: '1px solid rgba(168,85,247,.2)',
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  overviewLabel: { fontSize: 10, letterSpacing: 1.5, color: '#9C8BEF', fontWeight: 800 },
  overviewTotal: { fontSize: 28, fontWeight: 900, color: '#FDA4AF', letterSpacing: -1 },
  util: { display: 'flex', flexDirection: 'column', gap: 6 },
  utilBar: { height: 6, borderRadius: 6, background: 'rgba(255,255,255,.08)', overflow: 'hidden' },
  utilFill: { height: '100%', borderRadius: 6, transition: 'width .4s ease' },
  utilLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 700 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.06)',
    transition: 'transform .15s',
  },
  rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  identity: { minWidth: 0, flex: 1 },
  cardName: { fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  last4: { fontSize: 11, color: '#9CA3AF', fontWeight: 600 },
  meta: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  badge: { fontSize: 9, fontWeight: 900, letterSpacing: .6, padding: '4px 8px', borderRadius: 8 },
  balance: { fontSize: 18, fontWeight: 900, whiteSpace: 'nowrap' },
  bars: { display: 'flex', flexDirection: 'column', gap: 6 },
  barTrack: { height: 5, borderRadius: 5, background: 'rgba(255,255,255,.06)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5, transition: 'width .4s ease' },
  barLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: 700 },
  foot: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, color: '#9CA3AF' },
};
