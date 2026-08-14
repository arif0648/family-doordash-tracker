import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ session: authState.session, loading: false, error: null }),
}));

vi.mock('../hooks/useFamilyId', () => ({
  useFamilyId: () => ({ familyId: 'family-test', loading: false, error: null }),
}));

vi.mock('../components/auth/LoginPage', () => ({
  LoginPage: () => <div>Giriş Test Ekranı</div>,
}));

vi.mock('../components/transactions/TransactionsPage', () => ({
  TransactionsPage: () => <div>Hareketler Test Ekranı</div>,
}));

vi.mock('../components/home/HomePage', () => ({
  HomePage: () => <div>Ana Sayfa Test Ekranı</div>,
}));

vi.mock('../components/common/BottomNav', () => ({ BottomNav: () => null }));

import App from '../App';

describe('React Router auth ve deep-link sözleşmesi', () => {
  beforeEach(() => {
    authState.session = null;
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('korumalı deep link oturumsuz kullanıcıyı girişe yönlendirir', async () => {
    window.history.replaceState(null, '', '/islemler');
    render(<App />);

    expect(await screen.findByText('Giriş Test Ekranı')).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/giris'));
  });

  it('oturumlu kullanıcı Surge deep link rotasını doğrudan açabilir', async () => {
    authState.session = { user: { id: 'user-test', email: 'test@example.com' } };
    window.history.replaceState(null, '', '/islemler');
    render(<App />);

    expect(await screen.findByText('Hareketler Test Ekranı')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/islemler');
  });

  it('oturumlu kullanıcı giriş sayfasından ana sayfaya yönlendirilir', async () => {
    authState.session = { user: { id: 'user-test', email: 'test@example.com' } };
    window.history.replaceState(null, '', '/giris');
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });
});
