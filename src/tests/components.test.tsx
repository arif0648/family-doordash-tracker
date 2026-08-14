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
