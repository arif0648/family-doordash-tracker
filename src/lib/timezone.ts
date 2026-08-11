/**
 * timezone.ts
 *
 * Tüm "Bugün / Bu Hafta / Bu Ay" periyot sınırları BU dosyadan geçer.
 * America/Los_Angeles (Pacific) kullanılır — sunucu/tarayıcı UTC olsa bile
 * (Bölüm 1). DST (yaz/kış saati) geçişleri, native Intl.DateTimeFormat'ın
 * IANA tz veritabanını kullanmasıyla otomatik doğru hesaplanır — bu yüzden
 * hiçbir npm paketine (date-fns-tz vb.) ihtiyaç yoktur.
 */

const PACIFIC_TZ = 'America/Los_Angeles';

/** Returns 'YYYY-MM-DD' for the given instant, AS SEEN IN America/Los_Angeles. */
export function toPacificDateString(instant: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA locale formats as YYYY-MM-DD directly.
  return fmt.format(instant);
}

/** Returns the Pacific-local weekday index: 0=Sunday ... 6=Saturday. */
function pacificWeekdayIndex(instant: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    weekday: 'short',
  });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[fmt.format(instant)];
}

function addDaysToDateString(dateStr: string, days: number): string {
  // Parse as a plain calendar date (no timezone attached), shift, re-format.
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMidday = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // noon UTC avoids DST edge issues in the shift itself
  utcMidday.setUTCDate(utcMidday.getUTCDate() + days);
  const yyyy = utcMidday.getUTCFullYear();
  const mm = String(utcMidday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utcMidday.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export interface PeriodBoundary {
  start: string; // 'YYYY-MM-DD', inclusive, Pacific-local
  end: string; // 'YYYY-MM-DD', inclusive, Pacific-local
}

/** BUGÜN: Pacific 00:00 -> 23:59, i.e. a single Pacific calendar date. */
export function todayBoundary(now: Date = new Date()): PeriodBoundary {
  const d = toPacificDateString(now);
  return { start: d, end: d };
}

/**
 * BU HAFTA: Pazartesi 00:00 -> Pazar 23:59, Pacific.
 * (Payday alignment — money deposits Monday 23:00 Pacific, Bölüm 2.)
 */
export function weekBoundary(now: Date = new Date()): PeriodBoundary {
  const todayStr = toPacificDateString(now);
  const weekday = pacificWeekdayIndex(now); // 0=Sun..6=Sat
  // Days to subtract to reach Monday: Sun(0)->6, Mon(1)->0, Tue(2)->1, ...
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  const start = addDaysToDateString(todayStr, -daysSinceMonday);
  const end = addDaysToDateString(start, 6);
  return { start, end };
}

/** BU AY: ayın 1'i -> ayın son günü, Pacific. */
export function monthBoundary(now: Date = new Date()): PeriodBoundary {
  const todayStr = toPacificDateString(now);
  const [y, m] = todayStr.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = lastDayOfMonth(y, m);
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function boundaryForPeriod(
  period: 'today' | 'week' | 'month',
  now: Date = new Date()
): PeriodBoundary {
  if (period === 'today') return todayBoundary(now);
  if (period === 'week') return weekBoundary(now);
  return monthBoundary(now);
}
