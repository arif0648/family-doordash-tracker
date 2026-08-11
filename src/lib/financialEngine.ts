/**
 * DİKKAT: Ana hesaplama mantığı SQL veritabanına (RPC) taşınmıştır.
 * Bu dosya sadece uygulamanın genelinde kullanılan TypeScript tiplerini
 * ve hafif formatlama araçlarını barındırır.
 */

export interface IncomeRecord {
  id: string;
  vehicleId?: string;
  amount: number;
  recordDate: string; // ISO format (YYYY-MM-DD)
  notes?: string;
}

export interface ExpenseRecord {
  id: string;
  category: string;
  vehicleId?: string;
  amount: number;
  recordDate: string; // ISO format
  notes?: string;
}

export interface FixedExpenseVersion {
  id: string;
  label: string;
  monthlyAmount: number;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string;  // YYYY-MM-DD veya null
}

export interface VehicleSummary {
  totalIncome: number;
  variableExpenses: number;
  fixedExpenseShare: number;
  totalExpenses: number;
  netEarnings: number;
  hourlyRate: number;
  perMileRate: number;
  totalMiles: number;
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
