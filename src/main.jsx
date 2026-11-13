import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import App from './App';

// Chrome/Android fires this before it will show an install prompt; Settings triggers it later.
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__install = e; });

// Last line of defence: a render error shows a way back instead of a blank screen. Saved data is untouched.
class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-white/50">Your grove is safe. Reload to carry on.</p>
        <button onClick={() => location.reload()} className="cta h-12 rounded-full px-8 font-semibold">Reload</button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(<Boundary><App /></Boundary>);

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
