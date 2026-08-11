/**
 * DİKKAT: Dönemsel mil toplama mantığı SQL (RPC) tarafına taşınmıştır.
 * Bu dosya sadece Mil girişleri için TypeScript tiplerini barındırır.
 */

export interface MileageEntry {
  id: string;
  vehicleId?: string;
  recordDate: string;
  closingMileage: number;
  milesDriven: number;
  createdAt?: string;
}

// Form veya manuel giriş ekranlarında kullanılabilecek basit bir yardımcı fonksiyon
export function calculateMilesDriven(startMileage: number, endMileage: number): number {
  if (endMileage < startMileage) return 0;
  return endMileage - startMileage;
}
