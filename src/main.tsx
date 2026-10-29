import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker immediately for PWA installability and offline support
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('PWA: New content available, refresh to update.');
  },
  onOfflineReady() {
    console.log('PWA: App is ready to work offline.');
  }
});

createRoot(document.getElementById('root')!).render(<App />);
