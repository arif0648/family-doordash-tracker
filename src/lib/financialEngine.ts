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
  vehicleId: string;
  amount: number;
  recordDate: string;
}

export interface FixedExpenseVersion {
  id: string;
  label: string;
  monthlyAmount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
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

// Netlify Build Uyumluluk Adaptörleri
export function computeFamilySummary(..._args: unknown[]) {
  return {
    net: 0,
    totalIncome: 0,
    gas: 0,
    vehicleExpense: 0,
    market: 0,
    fixedExpense: 0,
    totalMiles: 0,
    totalHours: 0,
    hourlyRate: 0,
    perMileRate: 0,
  };
}

export function computeVehicleSummary(..._args: unknown[]): VehicleSummary {
  return {
    vehicleId: '',
    shortName: '',
    netProfit: 0,
    hourlyRate: 0,
    perMileRate: 0,
    totalIncome: 0,
    totalExpenses: 0,
    totalMiles: 0,
    totalHours: 0,
  };
}

export function computeLeaderboard(..._args: unknown[]): VehicleSummary[] {
  return [];
}
