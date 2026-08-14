/**
 * mileageEngine.ts
 *
 * ÖNEMLİ: Gerçek zincir hesaplaması ve yeniden hesaplama HER ZAMAN veritabanı
 * tarafında (supabase/migrations/0004_atomic_functions.sql) atomic olarak
 * yapılır — bu dosya sadece:
 *   (a) formda "kaydet"e basmadan önce anlık bir UI önizlemesi/uyarısı
 *       göstermek,
 *   (b) bu iş mantığını npm paketi olmadan gerçekten test edebilmek
 * için vardır. Frontend BU DOSYAYI kullanarak database'e parçalı yazma
 * yapmaz — sadece create_income_with_mileage / edit_mileage_entry /
 * delete_income_with_mileage RPC'lerini çağırır (Bölüm 11.0, 11.3).
 */

export interface MileageEntry {
  id: string;
  vehicleId: string;
  recordDate: string; // 'YYYY-MM-DD'
  createdAt: string; // ISO timestamp, tie-breaker for same-day entries
  closingMileage: number;
  milesDriven: number; // computed
}

export class MileageChainError extends Error {}

/**
 * Sorts a vehicle's mileage entries into chain order:
 * record_date, then created_at (Bölüm 11.1).
 */
export function chainOrder(entries: MileageEntry[]): MileageEntry[] {
  return [...entries].sort((a, b) => {
    if (a.recordDate !== b.recordDate) return a.recordDate < b.recordDate ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

/**
 * Recomputes miles_driven for an entire chain, mirroring the DB function
 * recalculate_mileage_chain(). Used for (a) UI preview and (b) pure-logic
 * tests (TEST H, TEST I).
 */
export function recalculateChain(entries: MileageEntry[]): MileageEntry[] {
  const ordered = chainOrder(entries);
  let prev: number | null = null;
  const result: MileageEntry[] = [];

  for (const entry of ordered) {
    if (prev === null) {
      result.push({ ...entry, milesDriven: 0 });
    } else {
      if (entry.closingMileage < prev) {
        throw new MileageChainError(
          `CHAIN_INTEGRITY_VIOLATION: closing mileage ${entry.closingMileage} is lower than previous ${prev}`
        );
      }
      result.push({ ...entry, milesDriven: roundMiles(entry.closingMileage - prev) });
    }
    prev = entry.closingMileage;
  }

  return result;
}

/**
 * Validates a NEW closing-mileage entry against the current chain tip,
 * for instant UI feedback before the user hits "Kaydet" (Bölüm 11.5).
 */
export function validateNewClosingMileage(
  existingChain: MileageEntry[],
  newClosingMileage: number
): { valid: true; milesDriven: number } | { valid: false; reason: string } {
  const ordered = chainOrder(existingChain);
  const last = ordered[ordered.length - 1];

  if (!last) {
    return { valid: true, milesDriven: 0 };
  }

  if (newClosingMileage < last.closingMileage) {
    return {
      valid: false,
      reason: `Yeni kilometre (${newClosingMileage}), önceki kayıttan (${last.closingMileage}) düşük olamaz.`,
    };
  }

  return { valid: true, milesDriven: roundMiles(newClosingMileage - last.closingMileage) };
}

export interface MileagePreview {
  valid: boolean;
  previousClosingMileage: number | null;
  nextClosingMileage: number | null;
  milesDriven: number;
  reason?: string;
}

/**
 * Previews a new entry at its actual record date. This matters for backdated
 * income: comparing only with the chain tip can reject a valid older entry or
 * hide that it would exceed the next closing mileage.
 */
export function previewMileageEntry(
  existingChain: MileageEntry[],
  newClosingMileage: number,
  recordDate: string
): MileagePreview {
  const ordered = chainOrder(existingChain);
  const before = ordered.filter((entry) => entry.recordDate <= recordDate);
  const after = ordered.filter((entry) => entry.recordDate > recordDate);
  const previous = before[before.length - 1] ?? null;
  const next = after[0] ?? null;
  const previousClosingMileage = previous?.closingMileage ?? null;
  const nextClosingMileage = next?.closingMileage ?? null;

  if (!Number.isFinite(newClosingMileage) || newClosingMileage < 0) {
    return { valid: false, previousClosingMileage, nextClosingMileage, milesDriven: 0, reason: 'Geçerli bir kapanış mili girin.' };
  }
  if (previous && newClosingMileage < previous.closingMileage) {
    return {
      valid: false, previousClosingMileage, nextClosingMileage, milesDriven: 0,
      reason: `Yeni kilometre (${newClosingMileage}), önceki kapanıştan (${previous.closingMileage}) düşük olamaz.`,
    };
  }
  if (next && newClosingMileage > next.closingMileage) {
    return {
      valid: false, previousClosingMileage, nextClosingMileage, milesDriven: 0,
      reason: `Yeni kilometre (${newClosingMileage}), sonraki kapanıştan (${next.closingMileage}) yüksek olamaz.`,
    };
  }
  return {
    valid: true,
    previousClosingMileage,
    nextClosingMileage,
    milesDriven: previous ? roundMiles(newClosingMileage - previous.closingMileage) : 0,
  };
}

/** Sum of miles_driven for entries whose recordDate falls within [start, end] inclusive. */
export function sumMilesInPeriod(
  entries: MileageEntry[],
  start: string,
  end: string
): number {
  return entries
    .filter((e) => e.recordDate >= start && e.recordDate <= end)
    .reduce((sum, e) => sum + e.milesDriven, 0);
}

function roundMiles(n: number): number {
  return Math.round(n * 10) / 10;
}
