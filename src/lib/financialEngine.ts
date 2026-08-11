export type Period = 'BUGÜN' | 'HAFTA' | 'AY' | 'YIL' | 'today' | 'week' | 'month';

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

/**
 * Leaderboard bileşeni için araç özetlerini net kâra göre sıralayan saf adaptör fonksiyonu.
 */
export function computeLeaderboard(summaries: VehicleSummary[]): VehicleSummary[] {
  if (!Array.isArray(summaries)) return [];
  return [...summaries].sort((a, b) => b.netProfit - a.netProfit);
}
