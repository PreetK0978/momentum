import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DataProvider } from './hooks/data';
import { ToastProvider } from './hooks/ui';
import { ensureDefaults } from './db/repo';
import { db } from './db/db';
import './index.css';

// Ask the browser to keep IndexedDB data even under storage pressure.
navigator.storage?.persist?.().catch(() => {});

ensureDefaults()
  .catch((e) => console.error('Failed to initialise database', e))
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ToastProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </ToastProvider>
      </React.StrictMode>,
    );
  });

// exposed for debugging in devtools
(window as unknown as { momentumDB: typeof db }).momentumDB = db;

// Offline support + "Add to Home Screen" on iPhone. Only in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
