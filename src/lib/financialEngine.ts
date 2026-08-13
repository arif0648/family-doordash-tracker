/**
 * financialEngine.ts
 *
 * TEK VE MERKEZİ finansal hesaplama katmanı (Master Instruction Bölüm 6).
 * Dashboard, Vehicles, Reports ve Leaderboard EKRANLARININ HİÇBİRİ kendi
 * hesaplamasını yazmaz — hepsi bu modülü çağırır. Aynı hesap iki farklı
 * ekranda iki farklı sonuç ASLA vermemelidir.
 *
 * Bu dosya hiçbir npm paketine bağımlı değildir (sadece native JS/TS) —
 * bu yüzden hem tarayıcıda hem de bu sandbox'ta saf Node.js ile gerçekten
 * test edilebilir/çalıştırılabilir.
 */

export type ExpenseCategory =
  | 'benzin'
  | 'arac_gideri'
  | 'market'
  | 'diger_aile'
  | 'diger_arac';

export interface IncomeRecord {
  id: string;
  userId?: string;
  vehicleId: string;
  amount: number;
  recordDate: string; // 'YYYY-MM-DD' in Pacific-local terms
}

export interface ExpenseRecord {
  id: string;
  category: ExpenseCategory;
  vehicleId: string | null;
  amount: number;
  recordDate: string;
}

export interface FixedExpenseVersion {
  id: string;
  label: string;
  monthlyAmount: number;
  effectiveFrom: string; // 'YYYY-MM-DD'
  effectiveTo: string | null;
}

export interface Vehicle {
  id: string;
  shortName: string;
}

export type Period = 'today' | 'week' | 'month';

export interface PeriodBoundary {
  /** inclusive, 'YYYY-MM-DD' Pacific-local dates */
  start: string;
  end: string;
}

// ---------------------------------------------------------------------------
// FIXED EXPENSE RESOLUTION (Bölüm 7 — versioning)
// ---------------------------------------------------------------------------

/**
 * Returns the total monthly fixed expense amount that was in effect on a
 * given date, using effective_from/effective_to versioning. This is what
 * guarantees "geçmiş hesaplamalar değişmemeli" when a fixed expense amount
 * changes later.
 */
export function totalFixedExpenseAsOf(
  versions: FixedExpenseVersion[],
  asOfDate: string
): number {
  return versions
    .filter(
      (v) =>
        v.effectiveFrom <= asOfDate &&
        (v.effectiveTo === null || v.effectiveTo >= asOfDate)
    )
    .reduce((sum, v) => sum + v.monthlyAmount, 0);
}

/** Per-vehicle share of the fixed expense: total / vehicleCount (never per day/week/mile). */
export function vehicleFixedShare(totalFixed: number, vehicleCount: number): number {
  if (vehicleCount <= 0) return 0;
  return roundCurrency(totalFixed / vehicleCount);
}

// ---------------------------------------------------------------------------
// PERIOD FILTERING
// ---------------------------------------------------------------------------

function inRange(dateStr: string, boundary: PeriodBoundary): boolean {
  return dateStr >= boundary.start && dateStr <= boundary.end;
}

export function filterIncomeByPeriod(
  income: IncomeRecord[],
  boundary: PeriodBoundary
): IncomeRecord[] {
  return income.filter((r) => inRange(r.recordDate, boundary));
}

export function filterExpensesByPeriod(
  expenses: ExpenseRecord[],
  boundary: PeriodBoundary
): ExpenseRecord[] {
  return expenses.filter((r) => inRange(r.recordDate, boundary));
}

// ---------------------------------------------------------------------------
// FAMILY NET  (Bölüm 9)
// ---------------------------------------------------------------------------

export interface FamilySummary {
  totalIncome: number;
  gas: number;
  vehicleExpense: number;
  market: number;
  otherFamily: number;
  otherVehicle: number;
  fixedExpense: number;
  net: number;
}

/**
 * Computes the family-level summary for a period.
 *
 * CRITICAL RULES enforced here (Bölüm 8):
 *  - period === 'today' | 'week'  -> fixedExpense is ALWAYS 0.
 *  - period === 'month'           -> fixedExpense is applied EXACTLY ONCE,
 *                                    using the version in effect on
 *                                    `monthAnchorDate` (never prorated).
 */
export function computeFamilySummary(args: {
  period: Period;
  boundary: PeriodBoundary;
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  fixedExpenseVersions: FixedExpenseVersion[];
  /** any date within the month being viewed, used to resolve the fixed-expense version */
  monthAnchorDate: string;
}): FamilySummary {
  const { period, boundary, income, expenses, fixedExpenseVersions, monthAnchorDate } = args;

  const periodIncome = filterIncomeByPeriod(income, boundary);
  const periodExpenses = filterExpensesByPeriod(expenses, boundary);

  const totalIncome = sum(periodIncome.map((r) => r.amount));
  const gas = sumByCategory(periodExpenses, 'benzin');
  const vehicleExpense = sumByCategory(periodExpenses, 'arac_gideri');
  const market = sumByCategory(periodExpenses, 'market');
  const otherFamily = sumByCategory(periodExpenses, 'diger_aile');
  const otherVehicle = sumByCategory(periodExpenses, 'diger_arac');

  const fixedExpense =
    period === 'month' ? totalFixedExpenseAsOf(fixedExpenseVersions, monthAnchorDate) : 0;

  const net = roundCurrency(
    totalIncome - fixedExpense - gas - vehicleExpense - market - otherFamily - otherVehicle
  );

  return {
    totalIncome: roundCurrency(totalIncome),
    gas: roundCurrency(gas),
    vehicleExpense: roundCurrency(vehicleExpense),
    market: roundCurrency(market),
    otherFamily: roundCurrency(otherFamily),
    otherVehicle: roundCurrency(otherVehicle),
    fixedExpense: roundCurrency(fixedExpense),
    net,
  };
}

// ---------------------------------------------------------------------------
// VEHICLE NET  (Bölüm 10)
// ---------------------------------------------------------------------------

export interface VehicleSummary {
  vehicleId: string;
  shortName: string;
  income: number;
  gas: number;
  vehicleExpense: number;
  otherVehicle: number;
  fixedShare: number;
  net: number; // operational net: income - directly-attached vehicle expenses
  operationalNet: number;
  estimatedNet: number;
  milesDriven: number;
}

/**
 * Computes per-vehicle summary. Market NEVER appears here (Bölüm 10 —
 * "Market NOT a vehicle expense"). diger_arac (vehicle-specific "Other")
 * DOES count against the vehicle, same as arac_gideri.
 */
export function computeVehicleSummary(args: {
  vehicle: Vehicle;
  period: Period;
  boundary: PeriodBoundary;
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  fixedExpenseVersions: FixedExpenseVersion[];
  monthAnchorDate: string;
  totalVehicleCount: number;
  /** miles_driven values already chained/computed by the mileage engine, filtered to this vehicle+period */
  milesInPeriod: number;
}): VehicleSummary {
  const {
    vehicle,
    period,
    boundary,
    income,
    expenses,
    fixedExpenseVersions,
    monthAnchorDate,
    totalVehicleCount,
    milesInPeriod,
  } = args;

  const periodIncome = filterIncomeByPeriod(income, boundary).filter(
    (r) => r.vehicleId === vehicle.id
  );
  const periodExpenses = filterExpensesByPeriod(expenses, boundary).filter(
    (r) => r.vehicleId === vehicle.id
  );

  const vIncome = sum(periodIncome.map((r) => r.amount));
  const gas = sumByCategory(periodExpenses, 'benzin');
  const vehicleExpense = sumByCategory(periodExpenses, 'arac_gideri');
  const otherVehicle = sumByCategory(periodExpenses, 'diger_arac');

  const fixedShare =
    period === 'month'
      ? vehicleFixedShare(totalFixedExpenseAsOf(fixedExpenseVersions, monthAnchorDate), totalVehicleCount)
      : 0;

  const operationalNet = roundCurrency(vIncome - gas - vehicleExpense - otherVehicle);
  const estimatedNet = roundCurrency(operationalNet - fixedShare);

  return {
    vehicleId: vehicle.id,
    shortName: vehicle.shortName,
    income: roundCurrency(vIncome),
    gas: roundCurrency(gas),
    vehicleExpense: roundCurrency(vehicleExpense),
    otherVehicle: roundCurrency(otherVehicle),
    fixedShare: roundCurrency(fixedShare),
    net: operationalNet, // kept for backward compatibility; now means operational net
    operationalNet,
    estimatedNet,
    milesDriven: milesInPeriod,
  };
}

// ---------------------------------------------------------------------------
// LEADERBOARD  (Bölüm 16 — never show an artificial winner when no data)
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  vehicleId: string;
  shortName: string;
  net: number;
}

export type LeaderboardResult =
  | { hasData: false }
  | { hasData: true; winner: LeaderboardEntry; ranking: LeaderboardEntry[] };

/**
 * Ranks vehicles by NET for the period. Returns hasData=false when there is
 * literally no income/expense activity in the period for ANY vehicle —
 * in that case the UI must show "Henüz veri yok", never a negative winner
 * driven purely by the fixed share.
 */
export function computeLeaderboard(args: {
  vehicleSummaries: VehicleSummary[];
  /** true if there was at least one real income or expense transaction in the period */
  hasAnyRealActivity: boolean;
}): LeaderboardResult {
  const { vehicleSummaries, hasAnyRealActivity } = args;

  if (!hasAnyRealActivity || vehicleSummaries.length === 0) {
    return { hasData: false };
  }

  const ranking = [...vehicleSummaries]
    .map((v) => ({ vehicleId: v.vehicleId, shortName: v.shortName, net: v.net }))
    .sort((a, b) => b.net - a.net);

  return { hasData: true, winner: ranking[0], ranking };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function sumByCategory(expenses: ExpenseRecord[], category: ExpenseCategory): number {
  return sum(expenses.filter((e) => e.category === category).map((e) => e.amount));
}

/** Avoids floating point artifacts like 640.0000000000001 in currency output. */
export function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100;
}
