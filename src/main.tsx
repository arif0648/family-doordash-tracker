import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  // Should be structurally impossible given index.html, but guard anyway
  // rather than silently failing into a blank screen.
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
