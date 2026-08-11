import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useFamilyId } from './hooks/useFamilyId';
import { useFamilyRealtimeData } from './hooks/useFamilyRealtimeData';
import { LoadingScreen, ErrorScreen } from './components/common/StateScreens';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { BottomNav } from './components/common/BottomNav';

import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import { ForgotPasswordPage, ResetPasswordPage } from './components/auth/PasswordResetPages';

import { HomePage } from './components/home/HomePage';
import { IncomeForm } from './components/income/IncomeForm';
import { ExpenseForm } from './components/expense/ExpenseForm';
import { VehiclesPage } from './components/vehicles/VehiclesPage';
import { CreditCardsPage } from './components/vehicles/CreditCardsPage';
import { ProfilePage } from './components/profile/ProfilePage';
import { ReportsPage } from './components/reports/ReportsPage';

export default function App() {
  const { session, loading: authLoading, error: authError } = useAuth();

  // Bölüm 25 / Master Instruction Bölüm 13: auth initialization sırasında
  // uygulama ASLA boş kalmamalı.
  if (authLoading) {
    return <LoadingScreen label="Yükleniyor…" />;
  }

  if (authError) {
    return <ErrorScreen message={authError} onRetry={() => window.location.reload()} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/giris" element={session ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/kayit-ol" element={session ? <Navigate to="/" /> : <SignupPage />} />
        <Route path="/sifremi-unuttum" element={session ? <Navigate to="/" /> : <ForgotPasswordPage />} />
        <Route path="/sifre-sifirla" element={<ResetPasswordPage />} />
        <Route
          path="/*"
          element={
            session ? (
              <AuthenticatedApp userId={session.user.id} email={session.user.email ?? ''} />
            ) : (
              <Navigate to="/giris" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

function AuthenticatedApp({ userId, email }: { userId: string; email: string }) {
  const { familyId, loading: familyLoading, error: familyError } = useFamilyId(userId);

  if (familyLoading) return <LoadingScreen label="Aile bilgisi yükleniyor…" />;
  if (familyError || !familyId) {
    return <ErrorScreen message={familyError ?? 'Aile bilgisi bulunamadı.'} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', paddingBottom: 72 }}>
      <Routes>
        <Route
          path="/"
          element={
            <ErrorBoundary boundaryName="Ana Sayfa">
              <HomePage familyId={familyId} />
            </ErrorBoundary>
          }
        />
        <Route
          path="/kazanc"
          element={
            <ErrorBoundary boundaryName="Kazanç">
              <IncomeFormWrapper familyId={familyId} />
            </ErrorBoundary>
          }
        />
        <Route
          path="/gider"
          element={
            <ErrorBoundary boundaryName="Gider">
              <ExpenseFormWrapper familyId={familyId} />
            </ErrorBoundary>
          }
        />
        <Route
          path="/araclar"
          element={
            <ErrorBoundary boundaryName="Araçlar">
              <VehiclesPage familyId={familyId} />
            </ErrorBoundary>
          }
        />
        <Route
          path="/kredi-kartlari"
          element={
            <ErrorBoundary boundaryName="Kredi Kartları">
              <CreditCardsPage familyId={familyId} userId={userId} />
            </ErrorBoundary>
          }
        />
        <Route
          path="/raporlar"
          element={
            <ErrorBoundary boundaryName="Raporlar">
              <ReportsPage familyId={familyId} />
            </ErrorBoundary>
          }
        />
        <Route
          path="/profil"
          element={
            <ErrorBoundary boundaryName="Profil">
              <ProfilePage userId={userId} email={email} />
            </ErrorBoundary>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

// IncomeForm / ExpenseForm need vehicle + mileage + settings data, which
// comes from the same central realtime hook (financial engine single-source
// rule extends to data-fetching too — no separate ad-hoc fetch here).
function IncomeFormWrapper({ familyId }: { familyId: string }) {
  const { vehicles, mileageLog, loading, error, retry } = useFamilyRealtimeData(familyId);
  if (loading) return <LoadingScreen label="Formlar hazırlanıyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;
  return (
    <IncomeForm
      familyId={familyId}
      vehicles={vehicles}
      mileageLog={mileageLog}
      userSettings={null}
      onSaved={retry}
    />
  );
}

function ExpenseFormWrapper({ familyId }: { familyId: string }) {
  const { vehicles, loading, error, retry } = useFamilyRealtimeData(familyId);
  if (loading) return <LoadingScreen label="Formlar hazırlanıyor…" />;
  if (error) return <ErrorScreen message={error} onRetry={retry} />;
  return <ExpenseForm familyId={familyId} vehicles={vehicles} userSettings={null} onSaved={retry} />;
}
