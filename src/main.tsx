import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js?v=5').catch(() => {});
      return;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('barbin-'))
        .map((name) => caches.delete(name))
    );
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML =
    '<div style="color:white;padding:24px;font-family:sans-serif">Uygulama başlatılamadı: kök element bulunamadı.</div>';
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary boundaryName="Uygulama">
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
