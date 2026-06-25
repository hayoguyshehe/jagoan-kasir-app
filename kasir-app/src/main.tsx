import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { ScreenOrientation } from '@capacitor/screen-orientation';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker
registerSW({ immediate: true });

// Lock orientation to portrait immediately
ScreenOrientation.lock({ orientation: 'landscape' }).catch(err => {
  console.warn("Screen orientation lock failed (likely running in a non-native browser context):", err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
