import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          setInterval(() => {
            registration.update().catch(() => undefined);
          }, 5 * 60 * 1000);
        }
      },
    });
  } catch {
    // ignore service worker registration errors inside restricted sandboxes
  }
}

createRoot(document.getElementById('root')!).render(<App />);
