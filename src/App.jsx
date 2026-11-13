import { useEffect, useRef, useState } from 'react';
import { Timer, Trees, Store, Trophy, Download, Upload } from 'lucide-react';
import Plant from './components/Plant';
import { Sheet, Toggle, Stepper, Toasts, toast } from './components/ui';
import { useGrowIn } from './lib/hooks';
import * as audio from './lib/audio';
import { APP } from './data';
import { useStore, getState, set, setSetting, rollover, exportData, importData, resetAll, haptic, SPEED } from './store';
import Focus from './screens/Focus';
import Grove from './screens/Grove';
import Shop from './screens/Shop';
import Journey from './screens/Journey';

const TABS = [['focus', 'Focus', Timer], ['grove', 'Grove', Trees], ['shop', 'Nursery', Store], ['journey', 'Journey', Trophy]];
const FLIES = [...Array(14)].map((_, i) => ({ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 17) % 100}%`, '--dx': `${((i * 29) % 80) - 40}px`, '--dy': `${-30 - ((i * 17) % 70)}px`, '--t': `${9 + (i % 6) * 2}s`, animationDelay: `${-i * 1.3}s` }));

function Backdrop({ deep }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="drift-a absolute -left-1/4 -top-1/4 h-[70%] w-[90%] rounded-full blur-3xl transition-opacity duration-[2000ms]" style={{ background: 'radial-gradient(closest-side, rgba(16,185,129,.22), transparent)', opacity: deep ? 1 : 0.7 }} />
      <div className="drift-b absolute -bottom-1/4 -right-1/4 h-[70%] w-[90%] rounded-full blur-3xl transition-opacity duration-[2000ms]" style={{ background: 'radial-gradient(closest-side, rgba(34,211,238,.14), transparent)', opacity: deep ? 1 : 0.6 }} />
      {FLIES.map((f, i) => <span key={i} className="firefly absolute h-1 w-1 rounded-full bg-emerald-200 shadow-[0_0_8px_2px_rgba(167,243,208,.7)]" style={f} />)}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 50% 50%, transparent 55%, rgba(0,0,0,.55))' }} />
    </div>
  );
}

function Welcome() {
  const g = useGrowIn('welcome', 2600);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink px-8 text-center">
      <Backdrop deep />
      <Plant species="oak" g={g} className="relative h-56 w-48" />
      <h1 className="anim-rise relative mt-4 text-5xl font-semibold tracking-tighter" style={{ animationDelay: '.3s' }}>{APP}</h1>
      <p className="anim-rise relative mt-3 text-white/55" style={{ animationDelay: '.45s' }}>Put the phone down. Grow something.</p>
      <div className="relative mt-8 w-full max-w-xs space-y-3 text-left text-sm text-white/70">
        {['Pick a tree. Its time is your timer.', 'Stay focused and it grows. Leave and it withers.', 'Every session adds to a grove that is only yours.'].map((t, i) => (
          <div key={i} className="anim-rise flex gap-3" style={{ animationDelay: `${0.6 + i * 0.12}s` }}><span className="tnum mt-px text-emerald-300">0{i + 1}</span>{t}</div>
        ))}
      </div>
      <button onClick={() => { audio.unlock(); haptic(15); set({ onboarded: true }); }} className="cta anim-rise relative mt-10 h-[60px] w-full max-w-xs rounded-full text-lg font-semibold" style={{ animationDelay: '1s' }}>Start growing</button>
    </div>
  );
}

const Row = ({ title, desc, children }) => (
  <div className="flex items-center gap-4 border-b border-white/[.06] py-3.5">
    <div className="min-w-0 flex-1"><div className="text-sm font-medium">{title}</div>{desc && <div className="mt-0.5 text-xs leading-snug text-white/40">{desc}</div>}</div>
    {children}
  </div>
);

function Settings({ open, onClose }) {
  const s = useStore(), c = s.settings, file = useRef();
  const [wipe, setWipe] = useState(false);
  const canNotify = typeof Notification !== 'undefined';
  const [perm, setPerm] = useState(canNotify ? Notification.permission : 'denied');
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const save = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
    a.download = `evergrove-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const open_ = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { importData(await f.text()); toast('Grove restored'); onClose(); } catch { toast('That file is not an Evergrove backup'); }
  };
  const install = async () => { const p = window.__install; if (!p) return; p.prompt(); await p.userChoice; window.__install = null; onClose(); };
  return (
    <Sheet open={open} onClose={() => { setWipe(false); onClose(); }} title="Settings">
      <Row title="Deep Focus" desc="Leave the app for more than 10 seconds and the plant withers."><Toggle on={c.deep} onChange={(v) => setSetting('deep', v)} /></Row>
      <Row title="Keep screen awake" desc="Stops the phone locking mid-session, so Deep Focus is fair."><Toggle on={c.awake} onChange={(v) => setSetting('awake', v)} /></Row>
      <Row title="Daily goal"><Stepper value={c.goal} min={15} max={480} step={15} unit="min" onChange={(v) => setSetting('goal', v)} /></Row>
      <Row title="Break length"><Stepper value={c.breakMin} min={1} max={30} step={1} unit="min" onChange={(v) => setSetting('breakMin', v)} /></Row>
      <Row title="Auto-start after break" desc="The next session begins as soon as a break ends."><Toggle on={c.auto} onChange={(v) => setSetting('auto', v)} /></Row>
      <Row title="Chimes"><Toggle on={c.sfx} onChange={(v) => setSetting('sfx', v)} /></Row>
      <Row title="Haptics" desc="Android only. iOS does not expose vibration to web apps."><Toggle on={c.haptics} onChange={(v) => setSetting('haptics', v)} /></Row>
      {canNotify && (
        <Row title="Notifications" desc={perm === 'denied' ? 'Blocked in your browser settings.' : 'Nudges when a plant finishes or starts wilting.'}>
          {perm === 'granted' ? <span className="text-xs text-emerald-300">On</span> : <button disabled={perm === 'denied'} onClick={async () => setPerm(await Notification.requestPermission())} className="press h-9 rounded-full bg-white/10 px-4 text-sm font-medium disabled:opacity-30">Allow</button>}
        </Row>
      )}
      {!standalone && (
        <Row title="Install app" desc={window.__install ? 'Adds Evergrove to your home screen.' : ios ? 'Tap Share, then “Add to Home Screen”.' : 'Use your browser menu, then “Install app”.'}>
          {window.__install && <button onClick={install} className="cta h-9 rounded-full px-4 text-sm font-semibold">Install</button>}
        </Row>
      )}
      <Row title="Backup" desc="Everything lives on this device. Export it to keep it safe.">
        <div className="flex gap-2">
          <button aria-label="Export" onClick={save} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><Download size={16} /></button>
          <button aria-label="Import" onClick={() => file.current.click()} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><Upload size={16} /></button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={open_} />
        </div>
      </Row>
      <button onClick={() => (wipe ? (resetAll(), setWipe(false), onClose(), toast('Fresh soil')) : setWipe(true))} className={`mt-5 w-full rounded-full py-3 text-sm font-medium ${wipe ? 'bg-rose-500/30 text-rose-100' : 'text-rose-300/70'}`}>{wipe ? 'Tap again to erase everything' : 'Erase all data'}</button>
      <p className="mt-3 text-center text-[11px] text-white/25">{APP} 1.0{SPEED > 1 ? ' · demo speed ×60' : ''}</p>
    </Sheet>
  );
}

export default function App() {
  const s = useStore();
  const [tab, setTab] = useState('focus'), [settings, setSettings] = useState(false);
  const busy = !!s.active, cur = busy || s.harvest ? 'focus' : tab, idx = TABS.findIndex((t) => t[0] === cur);

  useEffect(() => {
    const run = () => { if (document.hidden) return; const used = rollover(); if (used) toast(`Streak shield used · ${used} day${used > 1 ? 's' : ''} covered`); };
    run();
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
  }, []);

  // While a session or harvest is open, the Android back button must not close the app (that would wither the plant).
  const locked = busy || !!s.harvest;
  useEffect(() => {
    if (!locked) return;
    history.pushState({ guard: true }, '');
    const pop = () => {
      if (history.state?.guard || history.state?.sheet) return;
      history.pushState({ guard: true }, '');
      toast(getState().active ? 'Session running. Hold “give up” to leave.' : 'Choose your trees first.');
    };
    addEventListener('popstate', pop);
    return () => { removeEventListener('popstate', pop); if (history.state?.guard) history.back(); };
  }, [locked]);

  return (
    <div className="relative h-full overflow-hidden">
      <Backdrop deep={busy} />
      <main className="relative mx-auto h-full max-w-md">
        <div key={cur} className="anim-fade h-full">
          {cur === 'focus' && <Focus onSettings={() => setSettings(true)} go={setTab} />}
          {cur === 'grove' && <Grove go={setTab} />}
          {cur === 'shop' && <Shop />}
          {cur === 'journey' && <Journey />}
        </div>
        <nav className={`glass absolute inset-x-4 bottom-[var(--nav-b)] z-30 grid grid-cols-4 rounded-full p-1.5 transition-all duration-700 ${busy ? 'pointer-events-none translate-y-28 opacity-0' : ''}`}>
          <span className="absolute inset-y-1.5 left-1.5 w-[calc(25%-3px)] rounded-full bg-white/10 transition-transform duration-500" style={{ transform: `translateX(${idx * 100}%)`, transitionTimingFunction: 'cubic-bezier(.3,1.4,.5,1)' }} />
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => { setTab(id); haptic(5); }} className={`relative z-10 flex h-12 flex-col items-center justify-center gap-0.5 transition-colors ${cur === id ? 'text-emerald-300' : 'text-white/40'}`}>
              <Icon size={19} strokeWidth={cur === id ? 2.4 : 2} /><span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </nav>
      </main>
      <Settings open={settings} onClose={() => setSettings(false)} />
      <Toasts />
      {!s.onboarded && <Welcome />}
    </div>
  );
}
