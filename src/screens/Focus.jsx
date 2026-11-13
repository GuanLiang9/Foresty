import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flame, Settings2, Volume2, ShieldCheck, Coffee, Share2, Trophy, CloudRain, Wind, Waves, MoonStar, AudioWaveform, Droplets, Bell, Plus, Minus, ChevronRight, ArrowUp, Pause, Play, Zap, Lock } from 'lucide-react';
import Plant from '../components/Plant';
import { Sheet, Coin, toast } from '../components/ui';
import { useSmooth, useGrowIn, useCount } from '../lib/hooks';
import * as audio from '../lib/audio';
import { cl, mmss, dur, tier, notify } from '../lib/util';
import { SP, SOUNDS, PHRASES } from '../data';
import { useStore, getState, setSetting, startSession, cancelSession, finishSession, stopFree, confirmHarvest, heartbeat, select, addTag, buySound, togglePause, settlePause, isPaused, pausedTotal, pauseLeft, elapsedOf, streakOf, todayMinutes, haptic, sfx, SPEED, GRACE, MAX_SW, MIN_SW } from '../store';

const R = 138, C = 2 * Math.PI * R, MAX_MIN = 180;
const SOUND_ICON = { rain: CloudRain, wind: Wind, waves: Waves, fire: Flame, night: MoonStar, deep: AudioWaveform, stream: Droplets, bowls: Bell };
const MODES = [['timer', 'Plant a tree'], ['stopwatch', 'Free focus']];
const an = (name) => `${/^[aeiou]/i.test(name) ? 'An' : 'A'} ${name}`;
// Overlays render at <body> so they cover the tab bar and are not trapped in a screen's stacking context.
const Overlay = ({ children }) => createPortal(children, document.body);
const STARS = [[18, 22], [72, 14], [84, 34], [30, 44], [58, 28], [12, 58], [90, 56], [44, 12]];

function Dial({ frac, live, children }) {
  return (
    <div className="relative aspect-square w-full">
      <div className="absolute inset-[9%] overflow-hidden rounded-full shadow-[inset_0_0_60px_rgba(0,0,0,.8),0_0_80px_-20px_rgba(52,211,153,.35)]">{children}</div>
      <svg viewBox="0 0 320 320" className="pointer-events-none absolute inset-0">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a7f3d0" /><stop offset=".5" stopColor="#34d399" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
        </defs>
        <circle cx="160" cy="160" r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
        {[...Array(36)].map((_, i) => <line key={i} x1="160" y1="5" x2="160" y2={i % 3 ? 9 : 12} stroke="rgba(255,255,255,.22)" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${i * 10} 160 160)`} />)}
        <circle cx="160" cy="160" r={R} fill="none" stroke="url(#ring)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - cl(frac, 0.0001, 1))} transform="rotate(-90 160 160)" style={{ transition: live ? 'stroke-dashoffset .25s linear' : 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)', filter: 'drop-shadow(0 0 8px rgba(52,211,153,.6))' }} />
      </svg>
    </div>
  );
}

function Hold({ onDone, children, ms = 1300 }) {
  const [on, setOn] = useState(false), t = useRef();
  const stop = () => { setOn(false); clearTimeout(t.current); };
  const start = () => { setOn(true); t.current = setTimeout(() => { setOn(false); onDone(); }, ms); };
  useEffect(() => stop, []);
  return (
    <button onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()} className="relative h-14 flex-1 overflow-hidden rounded-full border border-white/10 bg-white/5 font-medium text-white/70">
      <span className="absolute inset-0 origin-left bg-rose-500/45" style={{ transform: `scaleX(${on ? 1 : 0})`, transition: on ? `transform ${ms}ms linear` : 'transform .25s' }} />
      <span className="relative">{children}</span>
    </button>
  );
}

function Burst() {
  return [...Array(22)].map((_, i) => {
    const a = (i / 22) * Math.PI * 2, d = 110 + ((i * 53) % 90);
    return <span key={i} className="anim-burst absolute left-1/2 top-1/2 h-3 w-2 rounded-[60%_0_60%_0]" style={{ '--bx': `${Math.cos(a) * d}px`, '--by': `${Math.sin(a) * d - 40}px`, '--br': `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`, background: ['#6ee7b7', '#34d399', '#22d3ee', '#fde68a'][i % 4], animationDelay: `${0.5 + (i % 5) * 0.04}s` }} />;
  });
}

const Line = ({ icon, children, delay }) => (
  <div className="glass anim-rise flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm" style={{ animationDelay: `${delay}s` }}>{icon}<span className="flex-1">{children}</span></div>
);

function Done({ r, breakMin, onBreak, onClose }) {
  const x = r.session, n = r.sessions.length, sp = SP[x.species], g = useGrowIn(x.id, 1500);
  const total = r.coins + r.unlocked.reduce((s, a) => s + a.reward, 0), coins = useCount(total, 1400);
  const share = () => navigator.share?.({ text: `I just grew ${n > 1 ? `${n} plants` : an(sp.name).toLowerCase()} with ${dur(r.minutes)} of focus in Evergrove.` }).catch(() => {});
  return (
    <div className="anim-fade fixed inset-0 z-40 overflow-y-auto bg-ink/95 backdrop-blur-2xl">
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-7 py-10 text-center">
        <div className="relative h-60 w-52 short:h-44 short:w-40">
          <div className="absolute inset-0 flex items-center justify-center"><div className="pulse-ring h-48 w-48 rounded-full border border-emerald-300/40 short:h-36 short:w-36" /></div>
          <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(closest-side, ${r.golden ? 'rgba(251,191,36,.35)' : 'rgba(52,211,153,.3)'}, transparent)` }} />
          <Burst />
          {r.sessions.slice(1, 3).map((y, i) => <Plant key={y.id} species={y.species} g={g} golden={y.golden} className="absolute bottom-0 h-3/5 w-3/5 opacity-90" style={i ? { right: '-22%' } : { left: '-22%' }} />)}
          <Plant species={x.species} g={g} golden={x.golden} className="relative h-full w-full" />
        </div>
        <p className={`anim-rise mt-2 text-[11px] font-semibold uppercase tracking-[.3em] ${r.golden ? 'shimmer' : 'text-emerald-300'}`}>{r.golden ? 'Golden bloom · coins doubled' : 'Fully grown'}</p>
        <h2 className="anim-rise mt-2 text-[40px] font-semibold leading-none tracking-tighter" style={{ animationDelay: '.08s' }}>{dur(r.minutes)} <span className="text-white/40">focused</span></h2>
        <p className="anim-rise mt-2 text-sm text-white/50" style={{ animationDelay: '.14s' }}>{n > 1 ? `${n} plants joined your grove.` : `${an(sp.name)} joined your grove.`}</p>
        <div className="mt-6 w-full space-y-2">
          <Line delay={0.25} icon={<Coin size={20} />}><b className="tnum">+{coins}</b> coins{r.boosted && <span className="text-amber-300"> · 2× boost used</span>}</Line>
          {r.boostEarned && <Line delay={0.3} icon={<Zap size={20} className="text-amber-300" fill="currentColor" />}>Daily goal reached · <b>2× boost</b> for your next session</Line>}
          {r.streakUp && <Line delay={0.35} icon={<Flame size={20} className="text-orange-400" />}><b>{r.streak}-day streak</b> — keep it alive tomorrow</Line>}
          {r.levelUp && <Line delay={0.45} icon={<ArrowUp size={20} className="text-cyan-300" />}>Level {r.level.level} · <b>{r.level.title}</b></Line>}
          {r.unlocked.map((a, i) => <Line key={a.id} delay={0.55 + i * 0.1} icon={<Trophy size={20} className="text-amber-300" />}><b>{a.name}</b> unlocked · +{a.reward}</Line>)}
        </div>
        <div className="mt-7 flex w-full gap-3">
          <button onClick={onBreak} className="press flex h-14 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 font-medium"><Coffee size={18} /> {breakMin} min break</button>
          <button onClick={onClose} className="cta h-14 flex-1 rounded-full font-semibold">Continue</button>
        </div>
        {navigator.share && <button onClick={share} className="mt-4 flex items-center gap-2 text-sm text-white/45"><Share2 size={14} /> Share</button>}
      </div>
    </div>
  );
}

function Failed({ r, onClose }) {
  const x = r.session;
  return (
    <div className="anim-fade fixed inset-0 z-40 flex flex-col items-center justify-center bg-ink/95 px-8 text-center backdrop-blur-2xl">
      <div className="relative h-52 w-44">
        <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(244,63,94,.16), transparent)' }} />
        <Plant species={x.species} g={Math.max(0.6, x.p)} dead className="relative h-full w-full" />
      </div>
      <p className="anim-rise mt-4 text-[11px] font-semibold uppercase tracking-[.3em] text-rose-300/80">Withered</p>
      <h2 className="anim-rise mt-2 text-3xl font-semibold tracking-tight">{r.reason === 'left' ? 'You wandered off.' : r.reason === 'short' ? 'Not quite rooted.' : 'Let go too soon.'}</h2>
      <p className="anim-rise mt-3 max-w-[18rem] text-sm leading-relaxed text-white/50" style={{ animationDelay: '.1s' }}>
        {r.reason === 'left' ? 'Deep Focus wilts a plant after 10 seconds away.' : r.reason === 'short' ? 'Free focus needs 10 minutes before anything can be planted.' : `${dur(x.secs / 60)} in. It stays in your grove as a reminder.`} One withered plant never ruined a forest.
      </p>
      <button onClick={onClose} className="cta mt-8 h-14 w-full max-w-xs rounded-full font-semibold">Plant again</button>
    </div>
  );
}

function Break({ until, onEnd }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => { const t = Date.now(); setNow(t); if (t >= until) { sfx('start'); haptic([40, 60, 40]); onEnd(true); } }, 250);
    return () => clearInterval(iv);
  }, [until]);
  return (
    <div className="anim-fade fixed inset-0 z-40 flex flex-col items-center justify-center bg-ink/95 px-8 text-center backdrop-blur-2xl">
      <div className="relative flex h-64 w-64 items-center justify-center">
        <div className="calm absolute inset-0 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(34,211,238,.28), rgba(52,211,153,.1) 60%, transparent)' }} />
        <div className="calm absolute inset-10 rounded-full border border-cyan-200/20" />
        <span className="tnum relative text-6xl font-semibold tracking-tighter">{mmss(((until - now) / 1000) * SPEED)}</span>
      </div>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[.3em] text-cyan-300">Break</p>
      <p className="mt-2 text-sm text-white/50">Breathe with the circle. Look at something far away.</p>
      <button onClick={() => onEnd(false)} className="press mt-8 h-12 rounded-full border border-white/10 bg-white/5 px-8 text-sm font-medium">Skip break</button>
    </div>
  );
}

// Free focus ends here: the minutes become a budget to spend on any mix of owned species.
function Harvest({ h, owned, streak, onDone }) {
  const budget = Math.floor(h.secs / 60);
  const list = useMemo(() => owned.map((id) => SP[id]).filter((s) => s.min <= budget).sort((a, b) => a.min - b.min), [owned, budget]);
  // Start from the single biggest tree that fits; the user can trade it for several smaller ones.
  const [pick, setPick] = useState(() => (list.length ? { [list[list.length - 1].id]: 1 } : {}));
  const used = list.reduce((n, s) => n + (pick[s.id] || 0) * s.min, 0), left = budget - used;
  const count = Object.values(pick).reduce((n, v) => n + v, 0);
  const bump = (id, d) => { setPick((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) + d) })); haptic(5); };
  const coins = Math.max(1, Math.round(budget * 0.5 * (1 + Math.min(streak, 10) * 0.03)));
  const go = () => onDone(list.flatMap((s) => Array(pick[s.id] || 0).fill(s.id)).reverse());
  return (
    <div className="anim-fade fixed inset-0 z-40 flex flex-col bg-ink/95 backdrop-blur-2xl">
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+28px)]">
        <p className="anim-rise text-[11px] font-semibold uppercase tracking-[.3em] text-emerald-300">Free focus complete</p>
        <h2 className="anim-rise mt-2 text-[40px] font-semibold leading-none tracking-tighter">{dur(budget)} <span className="text-white/40">to plant</span></h2>
        <p className="anim-rise mt-2 text-sm text-white/50" style={{ animationDelay: '.08s' }}>Spend it on one big tree or several small ones.</p>
        <div className="mt-4 h-2 shrink-0 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(used / budget) * 100}%`, background: 'linear-gradient(90deg,#34d399,#22d3ee)' }} /></div>
        <div className="tnum mt-2 flex justify-between text-xs text-white/45"><span>{dur(used)} planted</span><span>{left > 0 ? `${dur(left)} left over → coins` : 'All spent'}</span></div>
        <div className="no-scrollbar -mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1">
          {list.map((s) => {
            const n = pick[s.id] || 0;
            return (
              <div key={s.id} className={`mb-2 flex items-center gap-3 rounded-2xl border p-2 pr-3 transition-colors ${n ? 'border-emerald-300/50 bg-emerald-300/10' : 'border-white/[.07] bg-white/[.03]'}`}>
                <Plant species={s.id} sway={false} lite className="h-14 w-12 shrink-0" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{s.name}</div><div className="tnum text-xs text-white/45">{s.min} min</div></div>
                <button aria-label={`Remove ${s.name}`} disabled={!n} onClick={() => bump(s.id, -1)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/10 disabled:opacity-25"><Minus size={16} /></button>
                <span className="tnum w-5 text-center font-semibold">{n}</span>
                <button aria-label={`Add ${s.name}`} disabled={s.min > left} onClick={() => bump(s.id, 1)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/10 disabled:opacity-25"><Plus size={16} /></button>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-white/45"><Coin size={12} /> about +{coins} coins for the full {dur(budget)}</div>
        <button disabled={!count} onClick={go} className="cta mt-3 h-[60px] shrink-0 rounded-full text-lg font-semibold disabled:opacity-40">{count ? `Plant ${count} ${count > 1 ? 'trees' : 'tree'}` : 'Choose a tree'}</button>
      </div>
    </div>
  );
}

export default function Focus({ onSettings, go }) {
  const s = useStore(), a = s.active, cfg = s.settings;
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [note, setNote] = useState('');
  const [tagName, setTagName] = useState('');
  const [brk, setBrk] = useState(null);

  const show = (r) => {
    const ok = r.session.ok;
    sfx(ok ? 'done' : 'fail');
    haptic(ok ? [30, 60, 30, 60, 90] : 250);
    if (document.hidden) notify(ok ? 'Your plant is fully grown' : 'Your plant withered', ok ? `+${r.coins} coins. Come and see it.` : 'Come back and plant again.');
    setResult(r);
    setNote('');
  };
  const end = (ok, at, reason) => { const r = finishSession(ok, at, reason); if (r) show({ ...r, reason }); };
  const endFree = (at, reason) => {
    const r = stopFree(at, reason);
    if (r?.failed) show({ ...r.failed, reason: reason || 'short' });
    else if (r?.harvest) { sfx('start'); haptic([30, 60, 30]); if (document.hidden) notify('Free focus saved', 'Come back and choose your trees.'); }
  };

  // Session engine: wall-clock based so it survives throttled timers, backgrounding and reloads.
  useEffect(() => {
    if (!a) return;
    const timer = a.mode === 'timer', cap = timer ? a.planned : MAX_SW;
    const cur = () => getState().active;
    // Handles time spent away from the app between h and t. Returns true when the session ended because of it.
    const away = (h, t) => {
      const A = cur();
      if (!A) return true;
      const unpaused = t - h - (pausedTotal(A, t) - pausedTotal(A, h));
      if (!A.deep || unpaused <= GRACE) return false;
      const failAt = t - (unpaused - GRACE);
      if (elapsedOf(A, failAt) >= cap) return false;
      if (timer) end(false, failAt, 'left'); else endFree(failAt, 'left');
      return true;
    };
    if (Date.now() - a.seen > GRACE + 6000 && away(a.seen, Date.now())) return;
    let lock, hiddenAt = null;
    const wake = () => cfg.awake && navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    const tick = () => {
      settlePause();
      const A = cur(), t = Date.now();
      if (!A) return;
      setNow(t);
      if (elapsedOf(A, t) >= cap) { if (timer) end(true, t); else endFree(t); }
    };
    const vis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        heartbeat();
        const A = cur();
        if (A?.deep && !isPaused(A, hiddenAt)) notify('Come back — your plant is wilting', 'Return within 10 seconds to save it.');
      } else {
        const h = hiddenAt;
        hiddenAt = null;
        wake();
        if (!(h && away(h, Date.now()))) tick();
      }
    };
    tick();
    wake();
    const iv = setInterval(tick, 200), hb = setInterval(() => !document.hidden && heartbeat(), 4000);
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(iv); clearInterval(hb); document.removeEventListener('visibilitychange', vis); lock?.release().catch(() => {}); };
  }, [a?.start]);

  const levels = useMemo(() => Object.fromEntries(s.ownedSounds.map((id) => [id, cfg.sounds[id] || 0])), [s.ownedSounds, cfg.sounds]);
  useEffect(() => {
    if (a || sheet === 'sound') audio.play(levels);
    else audio.stop();
  }, [!!a, sheet, levels]);
  useEffect(() => () => audio.stop(), []);

  const timer = (a ? a.mode : cfg.mode) === 'timer';
  const sp = SP[a ? a.species : s.selected];
  const elapsed = a ? elapsedOf(a, now) : 0;
  const planned = a ? a.planned : sp.min * 60;
  const paused = !!a && isPaused(a, now);
  const progress = a ? cl(timer ? elapsed / planned : elapsed / 1800) : 0;
  const g = useSmooth(a ? 0.04 + 0.96 * Math.pow(progress, 1.3) : 1);
  const scale = timer ? tier(sp.min) : a ? tier(elapsed / 60) : 0.9;
  const frac = a ? (timer ? progress : (elapsed % 3600) / 3600) : timer ? sp.min / MAX_MIN : 0;
  const time = a ? (timer ? mmss(planned - elapsed) : mmss(elapsed, true)) : timer ? mmss(sp.min * 60) : '00:00';
  const streak = streakOf(s), today = todayMinutes(s);
  const tag = s.tags.find((t) => t.id === (a ? a.tag : cfg.tag)) || s.tags[0];
  const earn = Math.max(1, Math.round(sp.min * 0.5 * (1 + Math.min(streak, 10) * 0.03))) * (s.boosts > 0 ? 2 : 1);
  const cancelLeft = a ? Math.ceil((10000 - (now - a.start)) / 1000) : 0;
  const anySound = Object.values(levels).some((v) => v > 0);
  const canPause = !!a && (paused || pauseLeft(a, now) > 1000);
  const phrase = PHRASES[Math.floor(elapsed / 45) % PHRASES.length];

  const plant = () => { audio.unlock(); sfx('start'); haptic(15); startSession(note); };
  const harvest = (ids) => { const r = confirmHarvest(ids); if (r) show(r); };
  const unlockSound = (x) => {
    if (!buySound(x.id)) return toast(`${x.price - s.coins} more coins to go`);
    sfx('coin'); haptic(15); toast(`${x.name} unlocked`);
  };

  return (
    <div className={`flex h-full flex-col px-5 pt-[calc(env(safe-area-inset-top)+14px)] ${a ? 'pb-[calc(env(safe-area-inset-bottom)+20px)]' : 'pb-[calc(var(--nav-b)+80px)] short:pb-[calc(var(--nav-b)+72px)]'}`}>
      <header className={`flex items-center justify-between transition-all duration-700 ${a ? 'pointer-events-none -translate-y-3 opacity-0' : ''}`}>
        <div className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold">
          <Flame size={16} className={streak ? 'text-orange-400' : 'text-white/30'} fill={streak ? 'currentColor' : 'none'} />
          <span className="tnum">{streak}</span>
          <span className="mx-1 h-3.5 w-px bg-white/15" />
          <span className="tnum font-medium text-white/60">{dur(today)}<span className="text-white/30"> / {dur(cfg.goal)}</span></span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => go('shop')} className="glass press flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold"><Coin /><span className="tnum">{s.coins}</span></button>
          <button onClick={onSettings} aria-label="Settings" className="glass press flex h-10 w-10 items-center justify-center rounded-full"><Settings2 size={18} /></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 short:gap-2">
        <div className="flex h-9 items-center">
          {a ? (
            paused
              ? <p className="tnum text-center text-sm font-medium text-amber-300">Paused · resumes in {mmss((pauseLeft(a, now) / 1000) * SPEED)}</p>
              : <p key={phrase} className="anim-rise text-center text-sm text-white/55">{phrase}</p>
          ) : (
            <div className="glass relative grid grid-cols-2 rounded-full p-1 text-sm font-medium">
              <span className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-white/[.12] transition-transform duration-500" style={{ transform: `translateX(${timer ? 0 : 100}%)`, transitionTimingFunction: 'cubic-bezier(.3,1.4,.5,1)' }} />
              {MODES.map(([m, label]) => <button key={m} onClick={() => { setSetting('mode', m); haptic(6); }} className={`relative z-10 whitespace-nowrap px-4 py-1.5 transition-colors ${cfg.mode === m ? 'text-white' : 'text-white/45'}`}>{label}</button>)}
            </div>
          )}
        </div>

        <div className="dial-size">
          <Dial frac={frac} live={!!a}>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #12271f 0%, #0a1512 55%, #060c0a 100%)' }} />
            <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: a ? 0.2 + 0.8 * progress : 0.55, background: 'radial-gradient(90% 75% at 50% 105%, rgba(52,211,153,.45), rgba(34,211,238,.14) 45%, transparent 75%)' }} />
            {STARS.map(([x, y], i) => <span key={i} className="twinkle absolute h-[3px] w-[3px] rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.37}s`, animationDuration: `${2.5 + (i % 3)}s` }} />)}
            <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="absolute bottom-0 h-[22%] w-full">
              <defs><linearGradient id="soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14533f" /><stop offset="1" stopColor="#061510" /></linearGradient></defs>
              <path d="M0 60V34Q100 -6 200 34V60Z" fill="url(#soil)" />
            </svg>
            <div className={`absolute bottom-[10.5%] left-1/2 h-[74%] origin-[50%_92%] transition-[transform,opacity] duration-1000 ${paused ? 'opacity-50' : ''}`} style={{ transform: `translateX(-50%) scale(${scale})`, aspectRatio: '200/240' }}>
              <Plant species={sp.id} g={g} sway={!paused} className="h-full w-full" />
            </div>
          </Dial>
        </div>

        <div className="text-center">
          <div className={`tnum text-[68px] font-semibold leading-none tracking-tighter transition-opacity short:text-[52px] ${paused ? 'opacity-40' : ''}`}>{time}</div>
          <div className="mt-2 flex h-5 items-center justify-center gap-2 text-xs text-white/45 short:mt-1">
            {a ? (
              <>
                <span className="h-2 w-2 rounded-full" style={{ background: tag.color }} />{tag.name}
                {a.note && <span className="max-w-[10rem] truncate">· {a.note}</span>}
                {a.deep && <span className="flex items-center gap-1 text-emerald-300/80">· <ShieldCheck size={12} /> Deep Focus</span>}
              </>
            ) : timer ? (
              <><Coin size={12} /> about +{earn} coins{s.boosts > 0 && <span className="flex items-center gap-0.5 text-amber-300"><Zap size={11} fill="currentColor" />2× boost</span>}</>
            ) : 'Stop any time after 10 min, then choose your trees'}
          </div>
        </div>

        {!a && (
          <div className="flex w-full max-w-sm flex-col gap-2.5 short:gap-2">
            <div className="flex gap-2.5">
              <button onClick={() => setSheet('tag')} className="glass press flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-4 text-sm short:h-11">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tag.color, boxShadow: `0 0 10px ${tag.color}` }} />
                <span className="flex-1 truncate text-left font-medium">{tag.name}</span><ChevronRight size={15} className="shrink-0 text-white/30" />
              </button>
              {timer && (
                <button onClick={() => setSheet('species')} className="glass press flex h-12 min-w-0 flex-[1.35] items-center gap-2 rounded-2xl px-3 text-sm short:h-11">
                  <Plant species={s.selected} sway={false} lite className="h-8 w-7 shrink-0" />
                  <span className="flex-1 truncate text-left font-medium">{sp.name}</span><ChevronRight size={15} className="shrink-0 text-white/30" />
                </button>
              )}
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="What are you growing toward?" enterKeyHint="done" className="glass h-12 w-full shrink-0 rounded-2xl px-4 text-sm outline-none placeholder:text-white/30 focus:border-emerald-300/40 short:h-11" />
          </div>
        )}
      </div>

      {a ? (
        <div className="flex items-center gap-3">
          <button onClick={() => { audio.unlock(); setSheet('sound'); }} aria-label="Sounds" className={`glass press flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${anySound ? 'text-emerald-300' : ''}`}><Volume2 size={20} /></button>
          <button onClick={() => { togglePause(); haptic(8); }} disabled={!canPause} aria-label={paused ? 'Resume' : 'Pause'} className={`glass press flex h-14 w-14 shrink-0 items-center justify-center rounded-full disabled:opacity-30 ${paused ? 'text-amber-300' : ''}`}>{paused ? <Play size={20} /> : <Pause size={20} />}</button>
          {cancelLeft > 0
            ? <button onClick={() => { cancelSession(); haptic(8); }} className="press h-14 flex-1 rounded-full border border-white/10 bg-white/5 font-medium text-white/70">Cancel · {cancelLeft}s</button>
            : !timer && elapsed >= MIN_SW
              ? <button onClick={() => endFree()} className="cta h-14 flex-1 rounded-full font-semibold">Stop & plant</button>
              : <Hold onDone={() => (timer ? end(false, undefined, 'quit') : endFree(undefined, 'short'))}>Hold to give up</Hold>}
        </div>
      ) : (
        <button onClick={plant} className="cta mx-auto h-[60px] w-full max-w-sm shrink-0 rounded-full text-lg font-semibold tracking-tight short:h-[52px]">{timer ? `Plant · ${sp.min} min` : 'Start focusing'}</button>
      )}

      <Sheet open={sheet === 'tag'} onClose={() => setSheet(null)} title="Focus on">
        <div className="flex flex-wrap gap-2">
          {s.tags.map((t) => (
            <button key={t.id} onClick={() => { setSetting('tag', t.id); setSheet(null); }} className={`press flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium ${t.id === cfg.tag ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/5'}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />{t.name}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (tagName.trim()) { addTag(tagName); setTagName(''); setSheet(null); } }} className="mt-5 flex gap-2">
          <input value={tagName} onChange={(e) => setTagName(e.target.value)} maxLength={16} placeholder="New tag" className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none placeholder:text-white/30" />
          <button aria-label="Add tag" className="press flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Plus size={18} /></button>
        </form>
      </Sheet>

      <Sheet open={sheet === 'species'} onClose={() => setSheet(null)} title="Choose a tree">
        <p className="-mt-2 mb-4 text-sm text-white/45">Each tree sets its own focus time. Rarer trees ask for longer.</p>
        <div className="grid grid-cols-3 gap-2.5">
          {[...s.owned].sort((x, y) => SP[x].min - SP[y].min).map((id) => (
            <button key={id} onClick={() => { select(id); setSheet(null); haptic(6); }} className={`press flex flex-col items-center rounded-2xl border p-2 pb-3 ${id === s.selected ? 'border-emerald-300/60 bg-emerald-300/10' : 'border-white/10 bg-white/5'}`}>
              <Plant species={id} sway={false} lite className="h-20 w-full" />
              <span className="mt-1 w-full truncate text-xs font-medium">{SP[id].name}</span>
              <span className="tnum text-[11px] text-emerald-300">{SP[id].min} min</span>
            </button>
          ))}
        </div>
        <button onClick={() => { setSheet(null); go('shop'); }} className="mt-5 flex w-full items-center justify-center gap-1 text-sm text-emerald-300">Unlock more in the Nursery <ChevronRight size={15} /></button>
      </Sheet>

      <Sheet open={sheet === 'sound'} onClose={() => setSheet(null)} title="Soundscape">
        <p className="-mt-2 mb-3 text-sm text-white/45">Blend layers. They play while you focus.</p>
        {SOUNDS.map((x) => {
          const Icon = SOUND_ICON[x.id], has = s.ownedSounds.includes(x.id), v = has ? cfg.sounds[x.id] || 0 : 0;
          return (
            <label key={x.id} className="flex h-11 items-center gap-3">
              <Icon size={18} className={v ? 'text-emerald-300' : 'text-white/40'} />
              <span className={`w-32 text-sm ${has ? '' : 'text-white/45'}`}>{x.name}</span>
              {has
                ? <input type="range" min="0" max="1" step="0.05" value={v} onChange={(e) => { audio.unlock(); setSetting('sounds', { ...cfg.sounds, [x.id]: +e.target.value }); }} className="min-w-0 flex-1" />
                : <button onClick={() => unlockSound(x)} className="press ml-auto flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold"><Lock size={11} /><Coin size={12} />{x.price}</button>}
            </label>
          );
        })}
      </Sheet>

      <Overlay>
        {s.harvest && !result && <Harvest h={s.harvest} owned={s.owned} streak={streak} onDone={harvest} />}
        {result && (result.session.ok
          ? <Done r={result} breakMin={cfg.breakMin} onClose={() => setResult(null)} onBreak={() => { setResult(null); setBrk(Date.now() + (cfg.breakMin * 60000) / SPEED); }} />
          : <Failed r={result} onClose={() => setResult(null)} />)}
        {brk && <Break until={brk} onEnd={(natural) => { setBrk(null); if (natural && cfg.auto) { audio.unlock(); startSession(''); } }} />}
      </Overlay>
    </div>
  );
}
