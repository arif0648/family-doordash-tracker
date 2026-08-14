/**
 * components.test.tsx — vitest + @testing-library/react. NOT RUN in this
 * sandbox (npm/vitest/jsdom/@testing-library kurulamadı, ağ erişimi yok).
 * Gerçek deployment ortamında `npm run test` ile çalıştırılmalıdır.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { EmptyState, ErrorScreen, LoadingScreen } from '../components/common/StateScreens';
import { WeeklyGoalCard } from '../components/home/WeeklyGoalCard';
import { VehicleChampions } from '../components/home/VehicleChampions';
import { calculateHourlyRate } from '../lib/hourlyRate';

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
      expect(screen.getByText('KAZANÇ SIRALAMASI')).toBeInTheDocument();
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
    const goals = [{ user_id: 'u1', display_name: 'Ali', weekly_goal: 1400, week_income: 700, remaining: 700, percent: 50 }];
    render(<WeeklyGoalCard goals={goals} income={[]} vehicles={[]} now={new Date('2026-08-05T12:00:00-07:00')} />);
    expect(screen.getByText(/%50 Tamamlandı/i)).toBeInTheDocument();
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
