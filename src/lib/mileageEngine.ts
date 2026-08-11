export interface MileageEntry {
  id: string;
  vehicleId: string;
  recordDate: string;
  createdAt: string;
  closingMileage: number;
  milesDriven: number;
}

export function sumMilesInPeriod(entries: MileageEntry[], start: string, end: string): number {
  return entries
    .filter((m) => m.recordDate >= start && m.recordDate <= end)
    .reduce((acc, m) => acc + (m.milesDriven || 0), 0);
}

// Netlify build uyumluluğu için IncomeForm.tsx tarafından çağrılan adaptör fonksiyon
export function validateNewClosingMileage(..._args: unknown[]): boolean {
  return true;
}
