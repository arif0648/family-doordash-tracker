/**
 * runAll.ts
 *
 * Bağımlılıksız (npm paketi gerektirmeyen) test runner. Master Instruction
 * Bölüm 17'deki TEST G, G2, H, I ve Bölüm 26'daki TEST A-F burada GERÇEKTEN
 * çalıştırılır — bu dosyanın çıktısı gerçek PASS/FAIL sonucudur, uydurma
 * değildir. (Bu dosya `node` ile derlenmiş haliyle doğrudan çalıştırılır;
 * vitest gibi bir test framework'ü ağ erişimi gerektirdiği için bu sandbox'ta
 * kullanılamadı — o kısım NOT VERIFIED olarak raporlanmıştır.)
 */

import {
  computeFamilySummary,
  computeVehicleSummary,
  computeLeaderboard,
  totalFixedExpenseAsOf,
  vehicleFixedShare,
  IncomeRecord,
  ExpenseRecord,
  FixedExpenseVersion,
  Vehicle,
} from '../financialEngine';

import { todayBoundary, weekBoundary, monthBoundary, toPacificDateString } from '../timezone';

import {
  recalculateChain,
  validateNewClosingMileage,
  sumMilesInPeriod,
  MileageEntry,
  MileageChainError,
} from '../mileageEngine';

import { toCsv } from '../csvExport';

// Minimal ambient declaration so this file compiles without @types/node
// (this sandbox has no network access to install it). At runtime, Node
// provides the real `process` global.
declare const process: { exit(code: number): never };

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push(`${label}: expected ${e}, got ${a}`);
    console.log(`  FAIL  ${label}  (expected ${e}, got ${a})`);
  }
}

function assertThrows(fn: () => void, label: string) {
  try {
    fn();
    failed++;
    failures.push(`${label}: expected throw, but no error was thrown`);
    console.log(`  FAIL  ${label} (expected throw, none occurred)`);
  } catch (e) {
    passed++;
    console.log(`  PASS  ${label} (threw as expected: ${(e as Error).message})`);
  }
}

console.log('\n=== TEST A — Boş veri: Bugün/Bu Hafta/Bu Ay ===');
{
  const noIncome: IncomeRecord[] = [];
  const noExpenses: ExpenseRecord[] = [];
  const fixedVersions: FixedExpenseVersion[] = [
    { id: 'f1', label: 'Toplam', monthlyAmount: 6660, effectiveFrom: '2026-01-01', effectiveTo: null },
  ];

  const today = computeFamilySummary({
    period: 'today',
    boundary: { start: '2026-08-09', end: '2026-08-09' },
    income: noIncome,
    expenses: noExpenses,
    fixedExpenseVersions: fixedVersions,
    monthAnchorDate: '2026-08-09',
  });
  assertEqual(today.net, 0, 'TEST A — Bugün net = 0 (veri yok)');
  assertEqual(today.fixedExpense, 0, 'TEST A — Bugün fixedExpense = 0');

  const week = computeFamilySummary({
    period: 'week',
    boundary: { start: '2026-08-03', end: '2026-08-09' },
    income: noIncome,
    expenses: noExpenses,
    fixedExpenseVersions: fixedVersions,
    monthAnchorDate: '2026-08-09',
  });
  assertEqual(week.net, 0, 'TEST A — Bu Hafta net = 0 (veri yok)');
  assertEqual(week.fixedExpense, 0, 'TEST A — Bu Hafta fixedExpense = 0');

  const month = computeFamilySummary({
    period: 'month',
    boundary: { start: '2026-08-01', end: '2026-08-31' },
    income: noIncome,
    expenses: noExpenses,
    fixedExpenseVersions: fixedVersions,
    monthAnchorDate: '2026-08-15',
  });
  assertEqual(month.fixedExpense, 6660, 'TEST A — Bu Ay fixedExpense = 6660 (tam bir kez)');
  assertEqual(month.net, -6660, 'TEST A — Bu Ay net = -6660');

  const kia: Vehicle = { id: 'kia', shortName: 'Kia Sportage' };
  const kiaMonthly = computeVehicleSummary({
    vehicle: kia,
    period: 'month',
    boundary: { start: '2026-08-01', end: '2026-08-31' },
    income: noIncome,
    expenses: noExpenses,
    fixedExpenseVersions: fixedVersions,
    monthAnchorDate: '2026-08-15',
    totalVehicleCount: 3,
    milesInPeriod: 0,
  });
  assertEqual(kiaMonthly.fixedShare, 2220, 'TEST A — Kia aylık sabit pay = 2220 (asla 148 değil)');
  assertEqual(kiaMonthly.net, -2220, 'TEST A — Kia aylık net = -2220');
}

console.log('\n=== TEST B — Kia income $1000, gas $100, vehicle expense $50, market $200 ===');
{
  const income: IncomeRecord[] = [{ id: 'i1', vehicleId: 'kia', amount: 1000, recordDate: '2026-08-05' }];
  const expenses: ExpenseRecord[] = [
    { id: 'e1', category: 'benzin', vehicleId: 'kia', amount: 100, recordDate: '2026-08-05' },
    { id: 'e2', category: 'arac_gideri', vehicleId: 'kia', amount: 50, recordDate: '2026-08-05' },
    { id: 'e3', category: 'market', vehicleId: null, amount: 200, recordDate: '2026-08-05' },
  ];
  const fixedVersions: FixedExpenseVersion[] = [
    { id: 'f1', label: 'Toplam', monthlyAmount: 6660, effectiveFrom: '2026-01-01', effectiveTo: null },
  ];
  const boundary = { start: '2026-08-01', end: '2026-08-31' };

  const family = computeFamilySummary({
    period: 'month',
    boundary,
    income,
    expenses,
    fixedExpenseVersions: fixedVersions,
    monthAnchorDate: '2026-08-15',
  });
  assertEqual(family.net, -6010, 'TEST B — Aile Net = -6010');

  const kia: Vehicle = { id: 'kia', shortName: 'Kia Sportage' };
  const kiaSummary = computeVehicleSummary({
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
  assertEqual(kiaSummary.net, -1370, 'TEST B — Kia Net = -1370');

  const toyota: Vehicle = { id: 'toyota', shortName: 'Toyota Corolla' };
  const toyotaSummary = computeVehicleSummary({
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
  assertEqual(toyotaSummary.income, 0, 'TEST B — Toyota income = 0 (izole)');
  assertEqual(toyotaSummary.net, -2220, 'TEST B — Toyota net = -2220 (sadece sabit pay)');
}

console.log('\n=== TEST C — Mileage zinciri: 94150 -> 94380 -> 94610 ===');
{
  const entries: MileageEntry[] = [
    { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', closingMileage: 94150, milesDriven: 0 },
    { id: 'm2', vehicleId: 'kia', recordDate: '2026-08-02', createdAt: '2026-08-02T10:00:00Z', closingMileage: 94380, milesDriven: 0 },
    { id: 'm3', vehicleId: 'kia', recordDate: '2026-08-03', createdAt: '2026-08-03T10:00:00Z', closingMileage: 94610, milesDriven: 0 },
  ];
  const chain = recalculateChain(entries);
  assertEqual(chain[0].milesDriven, 0, 'TEST C — 1. kayıt mil = 0 (baseline)');
  assertEqual(chain[1].milesDriven, 230, 'TEST C — 2. kayıt mil = 230');
  assertEqual(chain[2].milesDriven, 230, 'TEST C — 3. kayıt mil = 230');
  assertEqual(
    chain.reduce((s, e) => s + e.milesDriven, 0),
    460,
    'TEST C — Toplam mil = 460'
  );
}

console.log('\n=== TEST D — Market family-only, never vehicle-attributed ===');
{
  const expenses: ExpenseRecord[] = [
    { id: 'e1', category: 'market', vehicleId: null, amount: 400, recordDate: '2026-08-05' },
  ];
  const fixedVersions: FixedExpenseVersion[] = [];
  const boundary = { start: '2026-08-01', end: '2026-08-31' };

  const family = computeFamilySummary({
    period: 'month',
    boundary,
    income: [],
    expenses,
    fixedExpenseVersions: fixedVersions,
    monthAnchorDate: '2026-08-15',
  });
  assertEqual(family.market, 400, 'TEST D — Aile Market = 400');

  for (const vid of ['kia', 'toyota', 'honda']) {
    const v: Vehicle = { id: vid, shortName: vid };
    const vs = computeVehicleSummary({
      vehicle: v,
      period: 'month',
      boundary,
      income: [],
      expenses,
      fixedExpenseVersions: fixedVersions,
      monthAnchorDate: '2026-08-15',
      totalVehicleCount: 3,
      milesInPeriod: 0,
    });
    assertEqual(vs.net, 0, `TEST D — ${vid} net = 0 (market hiç etkilemiyor)`);
  }
}

console.log('\n=== TEST G — Pacific hafta sınırı: Pazar 23:59 vs Pazartesi 00:01 ===');
{
  // 2026-08-09 is a Sunday (Pacific). 23:59 Pacific Sunday = next day ~06:59 UTC.
  // We construct explicit UTC instants and confirm the Pacific weekday /
  // week-boundary logic places them in different weeks.
  const sundayLatePacific = new Date('2026-08-10T06:59:00Z'); // = 2026-08-09 23:59 PDT (UTC-7)
  const mondayEarlyPacific = new Date('2026-08-10T07:01:00Z'); // = 2026-08-10 00:01 PDT

  const sundayDateStr = toPacificDateString(sundayLatePacific);
  const mondayDateStr = toPacificDateString(mondayEarlyPacific);
  assertEqual(sundayDateStr, '2026-08-09', 'TEST G — 06:59Z Pacific-tarih = 2026-08-09 (Pazar)');
  assertEqual(mondayDateStr, '2026-08-10', 'TEST G — 07:01Z Pacific-tarih = 2026-08-10 (Pazartesi)');

  const weekOfSunday = weekBoundary(sundayLatePacific);
  const weekOfMonday = weekBoundary(mondayEarlyPacific);
  assertEqual(weekOfSunday.end, '2026-08-09', 'TEST G — Pazar, o haftanın SON günü');
  assertEqual(weekOfMonday.start, '2026-08-10', 'TEST G — Pazartesi, YENİ haftanın İLK günü');
  assertEqual(
    weekOfSunday.start !== weekOfMonday.start,
    true,
    'TEST G — İki an FARKLI haftalara düşüyor'
  );
}

console.log('\n=== TEST G2 — DST geçiş sınırı (Mart 2026, Pacific "spring forward") ===');
{
  // US DST 2026: clocks spring forward on 2026-03-08 at 02:00 -> 03:00 local.
  // Verify a date just before and just after the transition still resolves
  // to the correct Pacific calendar date and doesn't crash/skip a day.
  const beforeDst = new Date('2026-03-08T09:59:00Z'); // 2026-03-08 01:59 PST (UTC-8)
  const afterDst = new Date('2026-03-08T10:01:00Z'); // 2026-03-08 03:01 PDT (UTC-7)
  assertEqual(toPacificDateString(beforeDst), '2026-03-08', 'TEST G2 — DST öncesi doğru Pacific tarih');
  assertEqual(toPacificDateString(afterDst), '2026-03-08', 'TEST G2 — DST sonrası doğru Pacific tarih (aynı gün)');

  const monthB = monthBoundary(new Date('2026-03-15T12:00:00Z'));
  assertEqual(monthB, { start: '2026-03-01', end: '2026-03-31' }, 'TEST G2 — Mart ay sınırı DST\'den etkilenmiyor');
}

console.log('\n=== TEST H — Mileage edit: 94380 -> 94300, zincir yeniden hesaplanmalı ===');
{
  const entries: MileageEntry[] = [
    { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', closingMileage: 94150, milesDriven: 0 },
    { id: 'm2', vehicleId: 'kia', recordDate: '2026-08-02', createdAt: '2026-08-02T10:00:00Z', closingMileage: 94300, milesDriven: 0 }, // edited from 94380
    { id: 'm3', vehicleId: 'kia', recordDate: '2026-08-03', createdAt: '2026-08-03T10:00:00Z', closingMileage: 94610, milesDriven: 0 },
  ];
  const chain = recalculateChain(entries);
  assertEqual(chain[1].milesDriven, 150, 'TEST H — 2. kayıt (düzenlenmiş) mil = 150');
  assertEqual(chain[2].milesDriven, 310, 'TEST H — 3. kayıt otomatik güncellendi: mil = 310');
}

console.log('\n=== TEST I — Aynı gün çoklu kayıt ===');
{
  const entries: MileageEntry[] = [
    { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-05', createdAt: '2026-08-05T08:00:00Z', closingMileage: 94150, milesDriven: 0 },
    { id: 'm2', vehicleId: 'kia', recordDate: '2026-08-05', createdAt: '2026-08-05T18:00:00Z', closingMileage: 94200, milesDriven: 0 }, // same day, later
  ];
  const chain = recalculateChain(entries);
  assertEqual(chain.length, 2, 'TEST I — Aynı gün iki ayrı kayıt korunuyor (üzerine yazılmıyor)');
  assertEqual(chain[1].milesDriven, 50, 'TEST I — İkinci kayıt mil = 50');
  assertEqual(
    sumMilesInPeriod(chain, '2026-08-05', '2026-08-05'),
    50,
    'TEST I — Günlük toplam mil doğru (0 + 50 = 50)'
  );
}

console.log('\n=== Negatif mileage koruması ===');
{
  const existing: MileageEntry[] = [
    { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', closingMileage: 94150, milesDriven: 0 },
  ];
  const result = validateNewClosingMileage(existing, 94000);
  assertEqual(result.valid, false, 'Negatif mil girişi reddediliyor');

  assertThrows(() => {
    recalculateChain([
      { id: 'm1', vehicleId: 'kia', recordDate: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', closingMileage: 94150, milesDriven: 0 },
      { id: 'm2', vehicleId: 'kia', recordDate: '2026-08-02', createdAt: '2026-08-02T10:00:00Z', closingMileage: 94000, milesDriven: 0 },
    ]);
  }, 'recalculateChain, azalan mileage için hata fırlatıyor');
}

console.log('\n=== Leaderboard — veri yokken sahte kazanan gösterme ===');
{
  const result = computeLeaderboard({ vehicleSummaries: [], hasAnyRealActivity: false });
  assertEqual(result.hasData, false, 'Leaderboard — veri yokken hasData=false ("Henüz veri yok")');

  const resultWithData = computeLeaderboard({
    vehicleSummaries: [
      { vehicleId: 'kia', income: 1000, gas: 100, vehicleExpense: 50, otherVehicle: 0, fixedShare: 2220, net: -1370, milesDriven: 230 },
      { vehicleId: 'toyota', income: 0, gas: 0, vehicleExpense: 0, otherVehicle: 0, fixedShare: 2220, net: -2220, milesDriven: 0 },
    ],
    hasAnyRealActivity: true,
  });
  assertEqual(resultWithData.hasData, true, 'Leaderboard — gerçek veri varken hasData=true');
  if (resultWithData.hasData) {
    assertEqual(resultWithData.winner.vehicleId, 'kia', 'Leaderboard — Kia kazanan (en yüksek net)');
  }
}

console.log('\n=== Expense category / vehicle_id kuralı (mantık seviyesinde ayna testi) ===');
{
  // Mirrors the DB CHECK constraint logic client-side for a fast UI-level test.
  function isValidExpense(category: string, vehicleId: string | null): boolean {
    if (['benzin', 'arac_gideri', 'diger_arac'].includes(category)) return vehicleId !== null;
    if (['market', 'diger_aile'].includes(category)) return vehicleId === null;
    return false;
  }
  assertEqual(isValidExpense('benzin', 'kia'), true, 'benzin + vehicle_id -> geçerli');
  assertEqual(isValidExpense('benzin', null), false, 'benzin + vehicle_id NULL -> geçersiz');
  assertEqual(isValidExpense('market', null), true, 'market + vehicle_id NULL -> geçerli');
  assertEqual(isValidExpense('market', 'kia'), false, 'market + vehicle_id dolu -> geçersiz');
  assertEqual(isValidExpense('diger_aile', null), true, 'diger_aile + NULL -> geçerli');
  assertEqual(isValidExpense('diger_arac', 'honda'), true, 'diger_arac + vehicle_id -> geçerli');
}

console.log('\n=== CSV Export — RFC4180 formatı ===');
{
  interface Row { date: string; amount: number; note: string; }
  const rows: Row[] = [{ date: '2026-08-05', amount: 100, note: 'test' }];
  const csv = toCsv(rows, [
    { header: 'Tarih', accessor: (r) => r.date },
    { header: 'Tutar', accessor: (r) => r.amount },
    { header: 'Not', accessor: (r) => r.note },
  ]);
  assertEqual(csv, 'Tarih,Tutar,Not\r\n2026-08-05,100,test', 'CSV — basit satır doğru formatlanıyor');

  const rowsWithQuotes: Row[] = [{ date: '2026-08-05', amount: 100, note: 'a, "quoted" note' }];
  const csvQuoted = toCsv(rowsWithQuotes, [{ header: 'Not', accessor: (r) => r.note }]);
  assertEqual(
    csvQuoted.includes('"a, ""quoted"" note"'),
    true,
    'CSV — virgül/tırnak RFC4180 kurallarına göre kaçırılıyor'
  );

  const emptyCsv = toCsv<Row>([], [{ header: 'Tarih', accessor: (r) => r.date }]);
  assertEqual(emptyCsv, 'Tarih', 'CSV — boş liste sadece başlık döner');
}

console.log(`\n=== SONUÇ: ${passed} PASS, ${failed} FAIL (toplam ${passed + failed} assertion) ===\n`);
if (failed > 0) {
  console.log('FAILED ASSERTIONS:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
} else {
  process.exit(0);
}
