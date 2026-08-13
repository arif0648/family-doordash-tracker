import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toPacificDateString } from '../../lib/timezone';
import { playWorkStartSound, playWorkEndSound, speak } from '../../lib/sound';
import { WorkSessionRow } from '../../types/database';

interface WorkTimeCardProps {
  familyId: string;
  todayIncome: number;
  weekIncome: number;
  workSessions: WorkSessionRow[];
}

interface WorkSummary {
  totalSeconds: number;
  totalIncome: number;
  hourlyRate: number | null;
}

interface WorkSummaryRpc {
  total_seconds: number;
  total_income: number;
  hourly_rate: number | null;
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}dk`;
  return `${h}s ${m}dk`;
}

function currency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WorkTimeCard({ familyId, todayIncome, weekIncome, workSessions }: WorkTimeCardProps) {
  const [now, setNow] = useState(() => new Date());
  const [todaySummary, setTodaySummary] = useState<WorkSummary>({ totalSeconds: 0, totalIncome: 0, hourlyRate: null });
  const [weekSummary, setWeekSummary] = useState<WorkSummary>({ totalSeconds: 0, totalIncome: 0, hourlyRate: null });
  const [loading, setLoading] = useState(false);
  const [optimisticActive, setOptimisticActive] = useState<boolean | null>(null);

  const openSession = useMemo(() => workSessions.find((s) => s.ended_at === null) ?? null, [workSessions]);
  const isActive = optimisticActive ?? Boolean(openSession);

  const elapsedSeconds = useMemo(() => {
    if (!openSession) return 0;
    return Math.max(0, (now.getTime() - new Date(openSession.started_at).getTime()) / 1000);
  }, [openSession, now]);

  useEffect(() => {
    setOptimisticActive(null);
  }, [openSession]);

  useEffect(() => {
    if (!openSession) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [openSession]);

  useEffect(() => {
    const today = toPacificDateString(new Date());
    void fetchSummary(today, today, setTodaySummary, todayIncome);
    void fetchWeekSummary(weekIncome);
  }, [familyId, todayIncome, weekIncome, workSessions]);

  async function fetchSummary(start: string, end: string, setter: (s: WorkSummary) => void, income: number) {
    const { data, error } = await supabase.rpc('get_work_summary', {
      p_family_id: familyId,
      p_start_date: start,
      p_end_date: end,
    });
    if (error || !data?.[0]) return;
    const row = data[0] as unknown as WorkSummaryRpc;
    setter({
      totalSeconds: Number(row.total_seconds ?? 0),
      totalIncome: income,
      hourlyRate: row.total_seconds > 0 ? income / (Number(row.total_seconds) / 3600) : null,
    });
  }

  async function fetchWeekSummary(weekIncome: number) {
    const nowDate = new Date();
    const pacificToday = toPacificDateString(nowDate);
    const [y, m, d] = pacificToday.split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const weekday = base.getUTCDay() === 0 ? 6 : base.getUTCDay() - 1;
    const monday = new Date(base);
    monday.setUTCDate(monday.getUTCDate() - weekday);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const start = toPacificDateString(monday);
    const end = toPacificDateString(sunday);
    await fetchSummary(start, end, setWeekSummary, weekIncome);
  }

  async function startWork() {
    setLoading(true);
    setOptimisticActive(true);
    const { error } = await supabase.rpc('start_work_session', { p_family_id: familyId });
    if (error) {
      setOptimisticActive(null);
      setLoading(false);
      alert('Çalışma başlatılamadı: ' + error.message);
      return;
    }
    playWorkStartSound();
    speak('Çalışma başladı');
    setLoading(false);
    void refetch();
  }

  async function endWork() {
    if (!openSession) {
      setOptimisticActive(null);
      return;
    }
    setLoading(true);
    setOptimisticActive(false);
    const { error } = await supabase.rpc('end_work_session', { p_session_id: openSession.id });
    if (error) {
      setOptimisticActive(null);
      setLoading(false);
      alert('Çalışma bitirilemedi: ' + error.message);
      return;
    }
    playWorkEndSound();
    speak('Çalışma sona erdi');
    setLoading(false);
    void refetch();
  }

  async function refetch() {
    const today = toPacificDateString(new Date());
    void fetchSummary(today, today, setTodaySummary, todayIncome);
    void fetchWeekSummary(weekIncome);
  }

  const activeTotal = todaySummary.totalSeconds + elapsedSeconds;

  return (
    <section style={S.section}>
      <div style={S.header}>
        <span style={S.kicker}>⏱️ ÇALIŞMA ZAMANI</span>
        <div style={S.status}>
          <span style={{ ...S.dot, background: isActive ? '#34D399' : '#F87171' }} />
          <span style={S.statusText}>{isActive ? 'ÇALIŞIYOR' : 'ÇALIŞMIYOR'}</span>
        </div>
      </div>

      <div style={S.main}>
        <div style={S.timerBox}>
          <div style={S.timerLabel}>Bugün çalışılan</div>
          <div style={S.timerValue}>{formatDuration(activeTotal)}</div>
          {isActive && openSession && <div style={S.timerSub}>Aktif oturum: {formatDuration(elapsedSeconds)}</div>}
        </div>

        <button
          onClick={isActive ? endWork : startWork}
          disabled={loading}
          style={{ ...S.btn, background: isActive ? '#F87171' : '#34D399' }}
        >
          {loading ? '...' : isActive ? 'Çalışmayı Bitir' : 'Çalışmaya Başla'}
        </button>
      </div>

      <div style={S.grid}>
        <div style={S.cell}>
          <div style={S.cellLabel}>💰 Bugünkü Kazanç</div>
          <div style={S.cellValue}>{currency(todayIncome)}</div>
        </div>
        <div style={S.cell}>
          <div style={S.cellLabel}>📈 Saatlik Kazanç</div>
          <div style={S.cellValue}>
            {activeTotal > 0 ? `${currency(todayIncome / (activeTotal / 3600))}/saat` : '—'}
          </div>
        </div>
        <div style={S.cell}>
          <div style={S.cellLabel}>🗓️ Bu Hafta</div>
          <div style={S.cellValue}>{formatDuration(weekSummary.totalSeconds)}</div>
        </div>
        <div style={S.cell}>
          <div style={S.cellLabel}>💰 Haftalık Kazanç</div>
          <div style={S.cellValue}>{currency(weekIncome)}</div>
        </div>
        <div style={{ ...S.cell, gridColumn: '1 / -1' }}>
          <div style={S.cellLabel}>📈 Ort. Saatlik</div>
          <div style={S.cellValue}>
            {weekSummary.totalSeconds > 0 ? `${currency(weekIncome / (weekSummary.totalSeconds / 3600))}/saat` : '—'}
          </div>
        </div>
      </div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  section: {
    padding: 10,
    borderRadius: 16,
    background: 'linear-gradient(145deg, rgba(25,18,56,.96), rgba(7,9,21,.98))',
    border: '1px solid rgba(168,85,247,.15)',
    boxShadow: '0 8px 20px rgba(0,0,0,.2)',
    marginBottom: 8,
    color: '#fff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kicker: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#9C8BEF',
    fontWeight: 900,
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,.06)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 800,
  },
  main: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  timerBox: {
    flex: 1,
  },
  timerLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  timerValue: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: -1,
  },
  timerSub: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  btn: {
    border: 'none',
    borderRadius: 12,
    padding: '10px 14px',
    color: 'white',
    fontWeight: 800,
    fontSize: 12,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 6,
  },
  cell: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 10,
    background: 'rgba(255,255,255,.04)',
  },
  cellLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  cellValue: {
    fontSize: 12,
    fontWeight: 800,
  },
};
