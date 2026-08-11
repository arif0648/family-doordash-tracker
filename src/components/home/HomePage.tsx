import React, { useMemo, useState } from 'react';
import { useFamilyRealtimeData } from '../../hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen, EmptyState } from '../common/StateScreens';
import {
  computeFamilySummary,
  computeVehicleSummary,
  Period,
  IncomeRecord,
  ExpenseRecord,
  FixedExpenseVersion,
} from '../../lib/financialEngine';
import { boundaryForPeriod, toPacificDateString } from '../../lib/timezone';
import { sumMilesInPeriod, MileageEntry } from '../../lib/mileageEngine';
import { colors } from '../../theme/theme';
import { TopNav } from './TopNav';
import { NetProfitCard } from './NetProfitCard';
import { QuickActionButtons } from './QuickActionButtons';
import { PeriodSelector } from './PeriodSelector';
import { VehicleCard } from './VehicleCard';
import { CreditCardAlert, CreditCardDue } from './CreditCardAlert';
import { DailyPerformanceSummary } from './DailyPerformanceSummary';
import { MarketTicker } from './MarketTicker';
import { BottomNav, BottomNavTab } from './BottomNav';
import { useMarketTicker } from '../../hooks/useMarketTicker';

const HERO_LABELS: Record<Period, string> = { today: 'BUGÜN', week: 'BU HAFTA', month: 'BU AY' };

interface HomePageProps {
  familyId: string;
  /**
   * BottomNav zaten üst düzey layout/App shell'inde render ediliyorsa
   * burada tekrar göstermemek için false geç.
   */
  showBottomNav?: boolean;
  onNavigate?: (tab: BottomNavTab) => void;
  /**
   * Var olan "gelir ekle" akışına (muhtemelen ayrı bir sayfa/modal olarak
   * zaten mevcut) bağlanman için callback. Verilmezse hızlı butonlar
   * kategori seçimini sadece konsola loglar.
   */
  onQuickAddIncome?: (category: string) => void;
  onQuickAddExpense?: (category: string) => void;
  /**
   * Kredi kartı verisi henüz ayrı bir yerden (0012_family_notifications.sql
   * tabanlı, sadece kart sahibine görünür sorgu) sağlanmıyorsa boş bırak —
   * kart bölümü otomatik gizlenir.
   */
  creditCardsDue?: CreditCardDue[];
  onMarkCreditCardPaid?: (id: string) => void;
}

export function HomePage({
  familyId,
  showBottomNav = true,
  onNavigate,
  onQuickAddIncome,
  onQuickAddExpense,
  creditCardsDue = [],
  onMarkCreditCardPaid,
}: HomePageProps) {
  const { vehicles, income, expenses, mileageLog, fixedExpenses, loading, error, retry } =
    useFamilyRealtimeData(familyId);
  const [period, setPeriod] = useState<Period>('today');
  const market = useMarketTicker();

  const now = new Date();
  const boundary = useMemo(() => boundaryForPeriod(period, now), [period]);
  const todayBoundary = useMemo(() => boundaryForPeriod('today', now), []);
  const monthAnchor = toPacificDateString(now);

  const incomeRecords: IncomeRecord[] = income.map((r) => ({
    id: r.id,
    vehicleId: r.vehicle_id,
    amount: r.amount,
    recordDate: r.record_date,
  }));
  const expenseRecords: ExpenseRecord[] = expenses.map((r) => ({
    id: r.id,
    category: r.category,
    vehicleId: r.vehicle_id,
    amount: r.amount,
    recordDate: r.record_date,
  }));
  const fixedVersions: FixedExpenseVersion[] = fixedExpenses.map((f) => ({
    id: f.id,
    label: f.label,
    monthlyAmount: f.monthly_amount,
    effectiveFrom: f.effective_from,
    effectiveTo: f.effective_to,
  }));
  const mileageEntries: MileageEntry[] = mileageLog.map((m) => ({
    id: m.id,
    vehicleId: m.vehicle_id,
    recordDate: m.record_date,
    createdAt: m.created_at,
    closingMileage: m.closing_mileage,
    milesDriven: m.miles_driven,
  }));

  if (loading) return <LoadingScreen label="Aile verileri yükleniyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;

  // Seçili periyoda göre (BUGÜN/HAFTA/AY) ana kâr/zarar kartı
  const familySummary = computeFamilySummary({
    period,
    boundary,
    income: incomeRecords,
    expenses: expenseRecords,
    fixedExpenseVersions: fixedVersions,
    monthAnchorDate: monthAnchor,
  });
  const totalMiles = sumMilesInPeriod(mileageEntries, boundary.start, boundary.end);

  // Periyot seçiminden bağımsız, her zaman BUGÜN — "GÜNLÜK PERFORMANS" bölümü için
  const todaySummary = computeFamilySummary({
    period: 'today',
    boundary: todayBoundary,
    income: incomeRecords,
    expenses: expenseRecords,
    fixedExpenseVersions: fixedVersions,
    monthAnchorDate: monthAnchor,
  });
  const todayMiles = sumMilesInPeriod(mileageEntries, todayBoundary.start, todayBoundary.end);

  const vehicleSummaries = vehicles.map((vehicle) => {
    const summary = computeVehicleSummary({
      vehicle: { id: vehicle.id, shortName: vehicle.short_name },
      period,
      boundary,
      income: incomeRecords,
      expenses: expenseRecords,
      fixedExpenseVersions: fixedVersions,
      monthAnchorDate: monthAnchor,
      totalVehicleCount: vehicles.length,
      milesInPeriod: sumMilesInPeriod(
        mileageEntries.filter((m) => m.vehicleId === vehicle.id),
        boundary.start,
        boundary.end
      ),
    });
    return { shortName: vehicle.short_name, summary };
  });

  const topNet = Math.max(...vehicleSummaries.map((v) => v.summary.net), -Infinity);
  const hasMultipleVehicles = vehicleSummaries.length > 1;

  return (
    <div style={styles.page}>
      <TopNav dateLabel={formatHeaderDate(now)} hasUnreadNotifications={creditCardsDue.some((c) => !c.paid)} />

      <div style={styles.content}>
        <NetProfitCard
          periodLabel={HERO_LABELS[period]}
          totalIncome={familySummary.totalIncome}
          totalExpense={
            familySummary.gas +
            familySummary.vehicleExpense +
            familySummary.market +
            familySummary.otherFamily +
            familySummary.otherVehicle +
            familySummary.fixedExpense
          }
          net={familySummary.net}
          totalMiles={totalMiles}
        />

        <QuickActionButtons
          onSelectIncomeCategory={(c) => (onQuickAddIncome ? onQuickAddIncome(c) : console.log('Gelir ekle:', c))}
          onSelectExpenseCategory={(c) => (onQuickAddExpense ? onQuickAddExpense(c) : console.log('Gider ekle:', c))}
        />

        <div style={{ marginTop: 16 }}>
          <PeriodSelector value={period} onChange={setPeriod} />
          {period === 'week' && <p style={styles.paydayNote}>Ödeme günü: Pazartesi 23:00 (Pacific)</p>}
        </div>

        <h2 style={styles.sectionTitle}>ARAÇLAR</h2>
        {vehicles.length === 0 ? (
          <EmptyState message="Henüz araç tanımlanmamış" icon="🚗" />
        ) : (
          <div style={styles.vehicleList}>
            {vehicleSummaries.map((v) => (
              <VehicleCard
                key={v.summary.vehicleId}
                shortName={v.shortName}
                summary={v.summary}
                showFixedShare={period === 'month'}
                isTopPerformer={hasMultipleVehicles && v.summary.net === topNet && topNet > 0}
              />
            ))}
          </div>
        )}

        {creditCardsDue.length > 0 && (
          <>
            <h2 style={styles.sectionTitle}>ÖDEMELER</h2>
            <CreditCardAlert cards={creditCardsDue} onMarkPaid={onMarkCreditCardPaid ?? (() => {})} />
          </>
        )}

        <h2 style={styles.sectionTitle}>GÜNLÜK PERFORMANS</h2>
        <DailyPerformanceSummary
          totalIncome={todaySummary.totalIncome}
          totalExpense={
            todaySummary.gas + todaySummary.vehicleExpense + todaySummary.market + todaySummary.otherFamily + todaySummary.otherVehicle
          }
          net={todaySummary.net}
          totalMiles={todayMiles}
        />

        <div style={styles.tickerRow}>
          <MarketTicker
            usdRate={market.usdRate}
            usdChangePercent={market.usdChangePercent}
            goldPrice={market.goldPrice}
            goldChangePercent={market.goldChangePercent}
          />
        </div>
      </div>

      {showBottomNav && <BottomNav active="home" onNavigate={onNavigate ?? (() => {})} />}
    </div>
  );
}

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: colors.bgBase, color: colors.textPrimary },
  content: { padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 },
  paydayNote: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: 700, letterSpacing: 0.3, margin: '4px 0 0' },
  vehicleList: { display: 'flex', flexDirection: 'column', gap: 10 },
  tickerRow: { display: 'flex', justifyContent: 'center' },
};
