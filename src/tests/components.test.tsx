/**
 * components.test.tsx — vitest + @testing-library/react. NOT RUN in this
 * sandbox (npm/vitest/jsdom/@testing-library kurulamadı, ağ erişimi yok).
 * Gerçek deployment ortamında `npm run test` ile çalıştırılmalıdır.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { EmptyState, ErrorScreen, LoadingScreen } from '../components/common/StateScreens';
import { WeeklyGoalCard } from '../components/home/WeeklyGoalCard';
import { VehicleChampions } from '../components/home/VehicleChampions';
import { calculateHourlyRate } from '../lib/hourlyRate';
import { parseMarketRatesPayload } from '../lib/marketRates';
import { unlockAudio, setSoundEnabled } from '../lib/sound';
import { shouldRefetchForRealtimeStatus } from '../hooks/useFamilyRealtimeData';
import { createDebouncedRefetch } from '../lib/realtimeSync';

function Bomb(): React.ReactElement {
  throw new Error('Kasıtlı test hatası');
}

describe('ErrorBoundary', () => {
  it('bir child crash ettiğinde tüm uygulamayı değil sadece kendi alanını gösterir', () => {
    render(
      <ErrorBoundary boundaryName="Test Alanı">
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Test Alanı yüklenemedi/i)).toBeInTheDocument();
  });

  it('Tekrar Dene butonu render edilir', () => {
    render(
      <ErrorBoundary boundaryName="Test Alanı">
        <Bomb />
      </ErrorBoundary>
    );
    const retryButton = screen.getByText('Tekrar Dene');
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    // After retry, it re-attempts rendering children (which will throw
    // again in this contrived test, but the important assertion is that
    // clicking Retry does not crash the test harness itself).
  });
});

describe('Hourly rate guard', () => {
  it('bir dakikanın altındaki süre için oran üretmez', () => {
    expect(calculateHourlyRate(100, 59)).toBeNull();
    expect(calculateHourlyRate(100, 60)).toBe(6000);
    expect(calculateHourlyRate(100, 3600)).toBe(100);
  });
});

describe('VehicleChampions', () => {
  const vehicles = [0, 1, 2].map((i) => ({
    id: `v${i}`, family_id: 'f1', short_name: `Araç ${i + 1}`, full_name: `Araç ${i + 1}`, make: '', model: '', fuel_type: 'gas', year: null,
    current_mileage: 0, is_active: true, created_at: '', updated_at: '',
  }));
  const income = [0, 1, 2].map((i) => ({ id: `i${i}`, userId: 'u1', vehicleId: `v${i}`, amount: 100 - i, recordDate: '2026-08-05' }));
  const now = new Date('2026-08-05T12:00:00-07:00');

  for (const count of [0, 1, 2, 3]) {
    it(`${count} araç durumunu crash olmadan gösterir`, () => {
      render(<VehicleChampions vehicles={vehicles.slice(0, count)} income={income.slice(0, count)} now={now} />);
      expect(screen.getByText('Günün Birincisi')).toBeInTheDocument();
      if (count === 0) expect(screen.getByText(/henüz gelir kaydı yok/i)).toBeInTheDocument();
      else expect(screen.getByText('Araç 1')).toBeInTheDocument();
    });
  }
});

describe('WeeklyGoalCard', () => {
  it('weekly goal 0 veya null ise divide-by-zero yapmaz', () => {
    const goals = [{ user_id: 'u1', display_name: 'Ali', weekly_goal: 0, week_income: 0, remaining: 0, percent: 0 }];
    render(<WeeklyGoalCard goals={goals} income={[]} vehicles={[]} now={new Date('2026-08-05T12:00:00-07:00')} />);
    expect(screen.getByText(/%0 Tamamlandı/i)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.00 kaldı/i)).toBeInTheDocument();
  });

  it('hedef %50 tamamlandığında gösterir', () => {
    const goals = [{ user_id: 'u1', vehicle_id: 'v1', display_name: 'Ali', weekly_goal: 1400, week_income: 0, remaining: 0, percent: 0 }];
    const vehicles = [{ id: 'v1', family_id: 'f1', short_name: 'Kia', full_name: 'Kia', make: '', model: '', fuel_type: 'gas', year: null, is_active: true, created_at: '' }];
    const income = [{ id: 'i1', userId: 'u1', vehicleId: 'v1', amount: 700, recordDate: '2026-08-05' }];
    render(<WeeklyGoalCard goals={goals} income={income} vehicles={vehicles} now={new Date('2026-08-05T12:00:00-07:00')} />);
    expect(screen.getByText(/%50 Tamamlandı/i)).toBeInTheDocument();
  });
});

describe('Market data helpers', () => {
  it('Türkiye piyasası alış/satış verisini doğrular; eksik veya ters fiyatı reddeder', () => {
    const payload = {
      usdBuy: 47.88, usdSell: 47.91,
      quarterGoldBuy: 10673.88, quarterGoldSell: 10919.78,
      source: 'Trunçgil Finans', sourceUpdatedAt: '2026-08-17T07:49:01+03:00',
    };
    expect(parseMarketRatesPayload(payload)).toEqual(payload);
    expect(parseMarketRatesPayload({ ...payload, quarterGoldBuy: null })).toBeNull();
    expect(parseMarketRatesPayload({ ...payload, usdBuy: 50, usdSell: 49 })).toBeNull();
  });
});

describe('Realtime refresh policy', () => {
  it('subscribe/reconnect sonrası refetch ister', () => {
    expect(shouldRefetchForRealtimeStatus('SUBSCRIBED')).toBe(true);
    expect(shouldRefetchForRealtimeStatus('CHANNEL_ERROR')).toBe(false);
  });

  it('event burstünü tek merkezi refetch çağrısında birleştirir', () => {
    vi.useFakeTimers();
    const refetch = vi.fn();
    const scheduler = createDebouncedRefetch(refetch, 120);

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();
    vi.advanceTimersByTime(119);
    expect(refetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refetch).toHaveBeenCalledTimes(1);

    scheduler.cancel();
    vi.useRealTimers();
  });
});

describe('Audio unlock', () => {
  it('suspended context için resume çağırır', async () => {
    const resume = vi.fn(async () => {});
    (window as any).AudioContext = class { state = 'suspended'; resume = resume; };
    setSoundEnabled(true);
    await unlockAudio();
    expect(resume).toHaveBeenCalled();
  });
});

describe('StateScreens', () => {
  it('LoadingScreen bir yükleniyor mesajı gösterir', () => {
    render(<LoadingScreen label="Test yükleniyor…" />);
    expect(screen.getByText('Test yükleniyor…')).toBeInTheDocument();
  });

  it('ErrorScreen mesajı ve retry butonunu gösterir', () => {
    const onRetry = () => {};
    render(<ErrorScreen message="Bir hata oluştu" onRetry={onRetry} />);
    expect(screen.getByText('Bir hata oluştu')).toBeInTheDocument();
    expect(screen.getByText('Tekrar Dene')).toBeInTheDocument();
  });

  it('EmptyState varsayılan olarak "Henüz veri yok" gösterir', () => {
    render(<EmptyState />);
    expect(screen.getByText('Henüz veri yok')).toBeInTheDocument();
  });
});
