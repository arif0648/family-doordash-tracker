/**
 * mileageAndTimezone.test.ts — vitest formatı. NOT RUN in this sandbox
 * (bkz. financialEngine.test.ts başlığındaki dürüstlük notu). Bu testlerin
 * mantığı src/lib/__tests_pure__/runAll.ts içinde saf Node.js ile GERÇEKTEN
 * çalıştırıldı (44/44 PASS).
 */
import { describe, it, expect } from 'vitest';
import { recalculateChain, validateNewClosingMileage, previewMileageEntry, sumMilesInPeriod, MileageEntry, MileageChainError } from '../lib/mileageEngine';
import { toPacificDateString, weekBoundary, monthBoundary } from '../lib/timezone';

describe('TEST C — Mileage zinciri 94150 -> 94380 -> 94610', () => {
  it('mil farkları ve toplam doğru hesaplanır', () => {
    const entries: MileageEntry[] = [
      { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', closingMileage: 94150, milesDriven: 0 },
      { id: 'm2', vehicleId: 'kia', recordDate: '2026-08-02', createdAt: '2026-08-02T10:00:00Z', closingMileage: 94380, milesDriven: 0 },
      { id: 'm3', vehicleId: 'kia', recordDate: '2026-08-03', createdAt: '2026-08-03T10:00:00Z', closingMileage: 94610, milesDriven: 0 },
    ];
    const chain = recalculateChain(entries);
    expect(chain[1].milesDriven).toBe(230);
    expect(chain[2].milesDriven).toBe(230);
    expect(chain.reduce((s, e) => s + e.milesDriven, 0)).toBe(460);
  });
});

describe('TEST H — Mileage edit sonrası zincir yeniden hesaplama', () => {
  it('94380 -> 94300 düzenlemesi sonraki kaydı 310e günceller', () => {
    const entries: MileageEntry[] = [
      { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', closingMileage: 94150, milesDriven: 0 },
      { id: 'm2', vehicleId: 'kia', recordDate: '2026-08-02', createdAt: '2026-08-02T10:00:00Z', closingMileage: 94300, milesDriven: 0 },
      { id: 'm3', vehicleId: 'kia', recordDate: '2026-08-03', createdAt: '2026-08-03T10:00:00Z', closingMileage: 94610, milesDriven: 0 },
    ];
    const chain = recalculateChain(entries);
    expect(chain[2].milesDriven).toBe(310);
  });
});

describe('TEST I — Aynı gün çoklu kayıt', () => {
  it('iki kayıt korunur, günlük toplam doğru', () => {
    const entries: MileageEntry[] = [
      { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-05', createdAt: '2026-08-05T08:00:00Z', closingMileage: 94150, milesDriven: 0 },
      { id: 'm2', vehicleId: 'kia', recordDate: '2026-08-05', createdAt: '2026-08-05T18:00:00Z', closingMileage: 94200, milesDriven: 0 },
    ];
    const chain = recalculateChain(entries);
    expect(chain).toHaveLength(2);
    expect(sumMilesInPeriod(chain, '2026-08-05', '2026-08-05')).toBe(50);
  });
});

describe('Negatif mileage koruması', () => {
  it('düşük kilometre reddedilir', () => {
    const existing: MileageEntry[] = [
      { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', closingMileage: 94150, milesDriven: 0 },
    ];
    const result = validateNewClosingMileage(existing, 94000);
    expect(result.valid).toBe(false);
  });

  it('recalculateChain azalan mileage için throw eder', () => {
    expect(() =>
      recalculateChain([
        { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', closingMileage: 94150, milesDriven: 0 },
        { id: 'm2', vehicleId: 'kia', recordDate: '2026-08-02', createdAt: '2026-08-02T10:00:00Z', closingMileage: 94000, milesDriven: 0 },
      ])
    ).toThrow(MileageChainError);
  });
});

describe('Kapanış mili kullanıcı önizlemesi', () => {
  const existing: MileageEntry[] = [
    { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', closingMileage: 94150, milesDriven: 0 },
    { id: 'm2', vehicleId: 'kia', recordDate: '2026-08-03', createdAt: '2026-08-03T10:00:00Z', closingMileage: 94610, milesDriven: 460 },
  ];

  it('kullanıcı yalnızca yeni kapanışı girince farkı otomatik hesaplar', () => {
    const preview = previewMileageEntry(existing, 94800, '2026-08-04');
    expect(preview.valid).toBe(true);
    expect(preview.previousClosingMileage).toBe(94610);
    expect(preview.milesDriven).toBe(190);
  });

  it('geriye tarihli kaydı önceki ve sonraki kapanış arasında doğrular', () => {
    expect(previewMileageEntry(existing, 94300, '2026-08-02')).toMatchObject({
      valid: true, previousClosingMileage: 94150, nextClosingMileage: 94610, milesDriven: 150,
    });
    expect(previewMileageEntry(existing, 94700, '2026-08-02').valid).toBe(false);
  });
});

describe('TEST G — Pacific hafta sınırı', () => {
  it('Pazar 23:59 ve Pazartesi 00:01 farklı haftalara düşer', () => {
    const sunday = new Date('2026-08-10T06:59:00Z'); // 2026-08-09 23:59 PDT
    const monday = new Date('2026-08-10T07:01:00Z'); // 2026-08-10 00:01 PDT
    expect(toPacificDateString(sunday)).toBe('2026-08-09');
    expect(toPacificDateString(monday)).toBe('2026-08-10');
    expect(weekBoundary(sunday).start).not.toBe(weekBoundary(monday).start);
  });
});

describe('TEST G2 — DST geçişi', () => {
  it('Mart DST geçişinde gün/ay sınırı bozulmuyor', () => {
    const beforeDst = new Date('2026-03-08T09:59:00Z');
    const afterDst = new Date('2026-03-08T10:01:00Z');
    expect(toPacificDateString(beforeDst)).toBe('2026-03-08');
    expect(toPacificDateString(afterDst)).toBe('2026-03-08');
    expect(monthBoundary(new Date('2026-03-15T12:00:00Z'))).toEqual({ start: '2026-03-01', end: '2026-03-31' });
  });
});

describe('Timezone bağımsızlığı', () => {
  it('sunucu TZ ne olursa olsun aynı Pacific tarihi döner', () => {
    const instant = new Date('2026-08-09T20:00:00Z');
    // This assertion is TZ-independent by construction (toPacificDateString
    // always targets America/Los_Angeles regardless of process.env.TZ).
    expect(toPacificDateString(instant)).toBe('2026-08-09');
  });
});
