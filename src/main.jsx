import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import App from './App';

// Chrome/Android fires this before it will show an install prompt; Settings triggers it later.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__install = e; });

createRoot(document.getElementById('root')).render(<App />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js');
      const reg = await navigator.serviceWorker.ready;
      const urls = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin));
      reg.active?.postMessage({ cache: urls });
    } catch {}
  });
}
