/**
 * financialEngine.test.ts
 *
 * DÜRÜSTLÜK NOTU: Bu dosya gerçek bir vitest test suite'idir ve `npm run test`
 * ile production/deployment ortamında çalıştırılmalıdır. Bu sandbox'ta ağ
 * erişimi olmadığı için vitest paketi kurulamadı, dolayısıyla bu dosya BURADA
 * çalıştırılamadı (NOT RUN). Ancak içerdiği testler, src/lib/__tests_pure__/
 * runAll.ts içinde npm bağımsız saf Node.js ile GERÇEKTEN çalıştırıldı ve
 * 44/44 PASS sonucu alındı — bu dosya, o testleri vitest formatına taşıyarak
 * CI/CD pipeline'ına entegre edilebilir hale getirir.
 */
import { describe, it, expect } from 'vitest';
import {
  computeFamilySummary,
  computeVehicleSummary,
  computeLeaderboard,
  computeVehicleIncomeLeaderboard,
  totalFixedExpenseAsOf,
  IncomeRecord,
  ExpenseRecord,
  FixedExpenseVersion,
  Vehicle,
} from '../lib/financialEngine';

const fixedVersions: FixedExpenseVersion[] = [
  { id: 'f1', label: 'Toplam', monthlyAmount: 6660, effectiveFrom: '2026-01-01', effectiveTo: null },
];

describe('TEST A — Boş veri', () => {
  it('Bugün: her şey sıfır, sabit gider yok', () => {
    const summary = computeFamilySummary({
      period: 'today',
      boundary: { start: '2026-08-09', end: '2026-08-09' },
      income: [],
      expenses: [],
      fixedExpenseVersions: fixedVersions,
      monthAnchorDate: '2026-08-09',
    });
    expect(summary.net).toBe(0);
    expect(summary.fixedExpense).toBe(0);
  });

  it('Bu Ay: sabit gider tam olarak bir kez, -6660', () => {
    const summary = computeFamilySummary({
      period: 'month',
      boundary: { start: '2026-08-01', end: '2026-08-31' },
      income: [],
      expenses: [],
      fixedExpenseVersions: fixedVersions,
      monthAnchorDate: '2026-08-15',
    });
    expect(summary.fixedExpense).toBe(6660);
    expect(summary.net).toBe(-6660);
  });

  it('Araç aylık sabit pay her zaman 2220, asla 148 değil', () => {
    const kia: Vehicle = { id: 'kia', shortName: 'Kia Sportage' };
    const summary = computeVehicleSummary({
      vehicle: kia,
      period: 'month',
      boundary: { start: '2026-08-01', end: '2026-08-31' },
      income: [],
      expenses: [],
      fixedExpenseVersions: fixedVersions,
      monthAnchorDate: '2026-08-15',
      totalVehicleCount: 3,
      milesInPeriod: 0,
    });
    expect(summary.fixedShare).toBe(2220);
    expect(summary.fixedShare).not.toBe(148);
  });
});

describe('TEST B — Kia income $1000, gas $100, vehicle expense $50, market $200', () => {
  const income: IncomeRecord[] = [{ id: 'i1', vehicleId: 'kia', amount: 1000, recordDate: '2026-08-05' }];
  const expenses: ExpenseRecord[] = [
    { id: 'e1', category: 'benzin', vehicleId: 'kia', amount: 100, recordDate: '2026-08-05' },
    { id: 'e2', category: 'arac_gideri', vehicleId: 'kia', amount: 50, recordDate: '2026-08-05' },
    { id: 'e3', category: 'market', vehicleId: null, amount: 200, recordDate: '2026-08-05' },
  ];
  const boundary = { start: '2026-08-01', end: '2026-08-31' };

  it('Aile Net = -6010', () => {
    const family = computeFamilySummary({
      period: 'month',
      boundary,
      income,
      expenses,
      fixedExpenseVersions: fixedVersions,
      monthAnchorDate: '2026-08-15',
    });
    expect(family.net).toBe(-6010);
  });

  it('Kia operational net = 850, estimated net = -1370', () => {
    const kia: Vehicle = { id: 'kia', shortName: 'Kia Sportage' };
    const summary = computeVehicleSummary({
      vehicle: kia,
      period: 'month',
      boundary,
      income,
      expenses,
      fixedExpenseVersions: fixedVersions,
      monthAnchorDate: '2026-08-15',
      totalVehicleCount: 3,
      milesInPeriod: 0,
    });
    expect(summary.net).toBe(850);
    expect(summary.operationalNet).toBe(850);
    expect(summary.estimatedNet).toBe(-1370);
    expect(summary.fixedShare).toBe(2220);
  });

  it('Toyota operational net = 0, estimated net = -2220', () => {
    const toyota: Vehicle = { id: 'toyota', shortName: 'Toyota Corolla' };
    const summary = computeVehicleSummary({
      vehicle: toyota,
      period: 'month',
      boundary,
      income,
      expenses,
      fixedExpenseVersions: fixedVersions,
      monthAnchorDate: '2026-08-15',
      totalVehicleCount: 3,
      milesInPeriod: 0,
    });
    expect(summary.income).toBe(0);
    expect(summary.net).toBe(0);
    expect(summary.operationalNet).toBe(0);
    expect(summary.estimatedNet).toBe(-2220);
  });
});

describe('TEST D — Market never vehicle-attributed', () => {
  it('Market sadece aile toplamına girer, hiçbir aracı etkilemez', () => {
    const expenses: ExpenseRecord[] = [
      { id: 'e1', category: 'market', vehicleId: null, amount: 400, recordDate: '2026-08-05' },
    ];
    const boundary = { start: '2026-08-01', end: '2026-08-31' };

    for (const vid of ['kia', 'toyota', 'honda']) {
      const v: Vehicle = { id: vid, shortName: vid };
      const summary = computeVehicleSummary({
        vehicle: v,
        period: 'month',
        boundary,
        income: [],
        expenses,
        fixedExpenseVersions: [],
        monthAnchorDate: '2026-08-15',
        totalVehicleCount: 3,
        milesInPeriod: 0,
      });
      expect(summary.net).toBe(0);
    }
  });
});

describe('Fixed expense versioning', () => {
  it('geçmiş ay eski tutarı kullanır, güncel ay yeni tutarı', () => {
    const versions: FixedExpenseVersion[] = [
      { id: 'v1', label: 'Ev Kirası', monthlyAmount: 2900, effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30' },
      { id: 'v2', label: 'Ev Kirası', monthlyAmount: 3100, effectiveFrom: '2026-07-01', effectiveTo: null },
    ];
    expect(totalFixedExpenseAsOf(versions, '2026-05-15')).toBe(2900);
    expect(totalFixedExpenseAsOf(versions, '2026-08-15')).toBe(3100);
  });
});

describe('Credit card spending does not double count', () => {
  it('Expense $100 market is subtracted once; no card debt parameter in family net', () => {
    const income: IncomeRecord[] = [];
    const expenses: ExpenseRecord[] = [
      { id: 'e1', category: 'market', vehicleId: null, amount: 100, recordDate: '2026-08-05' },
    ];
    const family = computeFamilySummary({
      period: 'month',
      boundary: { start: '2026-08-01', end: '2026-08-31' },
      income,
      expenses,
      fixedExpenseVersions: [],
      monthAnchorDate: '2026-08-15',
    });
    expect(family.totalIncome).toBe(0);
    expect(family.market).toBe(100);
    expect(family.net).toBe(-100);
  });
});

describe('Vehicle income leaderboard — gelir bazlı şampiyon', () => {
  const vehicles = [
    { id: 'kia', shortName: 'Kia Sportage' },
    { id: 'toyota', shortName: 'Toyota Corolla' },
  ];

  it('vehicle_id=null gelir family total\'e girer ama şampiyonlara değil', () => {
    const income: IncomeRecord[] = [
      { id: 'i1', vehicleId: null, amount: 500, recordDate: '2026-08-05' },
      { id: 'i2', vehicleId: 'kia', amount: 300, recordDate: '2026-08-05' },
    ];
    const family = computeFamilySummary({
      period: 'today',
      boundary: { start: '2026-08-05', end: '2026-08-05' },
      income,
      expenses: [],
      fixedExpenseVersions: [],
      monthAnchorDate: '2026-08-05',
    });
    const leaderboard = computeVehicleIncomeLeaderboard({ income, vehicles, boundary: { start: '2026-08-05', end: '2026-08-05' } });

    expect(family.totalIncome).toBe(800);
    expect(leaderboard.hasData).toBe(true);
    if (leaderboard.hasData) {
      expect(leaderboard.winner.shortName).toBe('Kia Sportage');
      expect(leaderboard.winner.amount).toBe(300);
      expect(leaderboard.ranking.length).toBe(1);
    }
  });

  it('doğru araç ismi ve sıralama', () => {
    const income: IncomeRecord[] = [
      { id: 'i1', vehicleId: 'toyota', amount: 420, recordDate: '2026-08-05' },
      { id: 'i2', vehicleId: 'kia', amount: 300, recordDate: '2026-08-05' },
    ];
    const result = computeVehicleIncomeLeaderboard({ income, vehicles, boundary: { start: '2026-08-05', end: '2026-08-05' } });
    expect(result.hasData).toBe(true);
    if (result.hasData) {
      expect(result.winner.shortName).toBe('Toyota Corolla');
      expect(result.winner.amount).toBe(420);
      expect(result.second?.shortName).toBe('Kia Sportage');
      expect(result.second?.amount).toBe(300);
    }
  });

  it('veri yoksa hasData=false', () => {
    const result = computeVehicleIncomeLeaderboard({ income: [], vehicles, boundary: { start: '2026-08-05', end: '2026-08-05' } });
    expect(result.hasData).toBe(false);
  });
});

describe('Family financial direction — income vs expenses', () => {
  it('income > expenses => positive', () => {
    const income: IncomeRecord[] = [{ id: 'i1', vehicleId: null, amount: 1000, recordDate: '2026-08-05' }];
    const expenses: ExpenseRecord[] = [{ id: 'e1', category: 'market', vehicleId: null, amount: 400, recordDate: '2026-08-05' }];
    const family = computeFamilySummary({
      period: 'today',
      boundary: { start: '2026-08-05', end: '2026-08-05' },
      income,
      expenses,
      fixedExpenseVersions: [],
      monthAnchorDate: '2026-08-05',
    });
    expect(family.net).toBe(600);
    expect(family.net).toBeGreaterThan(0);
  });

  it('income < expenses => negative', () => {
    const income: IncomeRecord[] = [{ id: 'i1', vehicleId: null, amount: 500, recordDate: '2026-08-05' }];
    const expenses: ExpenseRecord[] = [{ id: 'e1', category: 'market', vehicleId: null, amount: 900, recordDate: '2026-08-05' }];
    const family = computeFamilySummary({
      period: 'today',
      boundary: { start: '2026-08-05', end: '2026-08-05' },
      income,
      expenses,
      fixedExpenseVersions: [],
      monthAnchorDate: '2026-08-05',
    });
    expect(family.net).toBe(-400);
    expect(family.net).toBeLessThan(0);
  });
});

describe('Leaderboard — veri yokken sahte kazanan yok', () => {
  it('hasAnyRealActivity=false -> hasData=false', () => {
    const result = computeLeaderboard({ vehicleSummaries: [], hasAnyRealActivity: false });
    expect(result.hasData).toBe(false);
  });
});
