export type Period = 'BUGÜN' | 'HAFTA' | 'AY' | 'YIL' | 'today' | 'week' | 'month';

export interface IncomeRecord {
  id: string;
  vehicleId: string;
  amount: number;
  recordDate: string;
}

export interface ExpenseRecord {
  id: string;
  category: string;
  vehicleId?: string;
  amount: number;
  recordDate: string;
}

export interface FixedExpenseVersion {
  id: string;
  label: string;
  monthlyAmount: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface DateBoundary {
  start: string;
  end: string;
}

export interface VehicleSummary {
  vehicleId: string;
  shortName: string;
  netProfit: number;
  hourlyRate: number;
  perMileRate: number;
  totalIncome: number;
  totalExpenses: number;
  totalMiles: number;
  totalHours: number;
}

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
 * Leaderboard bileşeni için araç özetlerini net kâra göre sıralayan saf adaptör fonksiyonu.
 */
export function computeLeaderboard(summaries: VehicleSummary[]): VehicleSummary[] {
  if (!Array.isArray(summaries)) return [];
  return [...summaries].sort((a, b) => b.netProfit - a.netProfit);
}

/**
 * Aile özeti hesaplar
 */
export function computeFamilySummary({
  period,
  boundary,
  income,
  expenses,
  fixedExpenseVersions,
  monthAnchorDate,
}: {
  period: Period;
  boundary: DateBoundary;
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  fixedExpenseVersions: FixedExpenseVersion[];
  monthAnchorDate: string;
}): FamilySummary {
  const totalIncome = income
    .filter((r) => r.recordDate >= boundary.start && r.recordDate <= boundary.end)
    .reduce((sum, r) => sum + r.amount, 0);

  let gas = 0;
  let vehicleExpense = 0;
  let market = 0;
  let otherFamily = 0;
  let otherVehicle = 0;

  expenses
    .filter((e) => e.recordDate >= boundary.start && e.recordDate <= boundary.end)
    .forEach((e) => {
      if (e.category === 'gas') gas += e.amount;
      else if (e.category === 'vehicle') vehicleExpense += e.amount;
      else if (e.category === 'market') market += e.amount;
      else if (e.category === 'other' && !e.vehicleId) otherFamily += e.amount;
      else if (e.category === 'other' && e.vehicleId) otherVehicle += e.amount;
    });

  const fixedExpense = fixedExpenseVersions
    .filter((f) => f.effectiveFrom <= boundary.end && (!f.effectiveTo || f.effectiveTo >= boundary.start))
    .reduce((sum, f) => sum + f.monthlyAmount, 0);

  const totalExpenses = gas + vehicleExpense + market + otherFamily + otherVehicle + fixedExpense;
  const net = totalIncome - totalExpenses;

  return {
    totalIncome,
    gas,
    vehicleExpense,
    market,
    otherFamily,
    otherVehicle,
    fixedExpense,
    net,
  };
}

/**
 * Araç özeti hesaplar
 */
export function computeVehicleSummary({
  vehicle,
  period,
  boundary,
  income,
  expenses,
  fixedExpenseVersions,
  monthAnchorDate,
  totalVehicleCount,
  milesInPeriod,
}: {
  vehicle: { id: string; shortName: string };
  period: Period;
  boundary: DateBoundary;
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
  fixedExpenseVersions: FixedExpenseVersion[];
  monthAnchorDate: string;
  totalVehicleCount: number;
  milesInPeriod: number;
}): VehicleSummary {
  const vehicleIncome = income
    .filter((r) => r.vehicleId === vehicle.id && r.recordDate >= boundary.start && r.recordDate <= boundary.end)
    .reduce((sum, r) => sum + r.amount, 0);

  const vehicleExpenses = expenses
    .filter((e) => e.vehicleId === vehicle.id && e.recordDate >= boundary.start && e.recordDate <= boundary.end)
    .reduce((sum, e) => sum + e.amount, 0);

  const sharedFixedExpense =
    fixedExpenseVersions
      .filter((f) => f.effectiveFrom <= boundary.end && (!f.effectiveTo || f.effectiveTo >= boundary.start))
      .reduce((sum, f) => sum + f.monthlyAmount, 0) / Math.max(totalVehicleCount, 1);

  const totalExpenses = vehicleExpenses + sharedFixedExpense;
  const netProfit = vehicleIncome - totalExpenses;

  const hourlyRate = milesInPeriod > 0 ? netProfit / Math.max(milesInPeriod / 50, 1) : 0;
  const perMileRate = milesInPeriod > 0 ? netProfit / milesInPeriod : 0;

  return {
    vehicleId: vehicle.id,
    shortName: vehicle.shortName,
    netProfit,
    hourlyRate,
    perMileRate,
    totalIncome: vehicleIncome,
    totalExpenses,
    totalMiles: milesInPeriod,
    totalHours: milesInPeriod / 50,
  };
}