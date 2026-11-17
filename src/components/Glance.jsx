import { Flame, Timer, Trees, Sprout } from 'lucide-react';
import { Sheet } from './ui';
import { Island } from '../screens/Grove';
import { SP } from '../data';
import { dur } from '../lib/util';
import { useStore, periodRange, streakOf, todayMinutes } from '../store';

// The in-app "widget": today's island at a glance, plus one-tap starts. Opened from the pill at the top of
// the Focus screen, or directly with ?go=widget (see lib/launch.js).
export default function Glance({ open, onClose, onStart, onGrove }) {
  const s = useStore(), c = s.settings;
  const { a, b } = periodRange('day', 0);
  const list = s.sessions.filter((x) => x.end >= a && x.end < b), grown = list.filter((x) => x.ok).length;
  const today = todayMinutes(s), streak = streakOf(s), pct = Math.min(100, Math.round((today / c.goal) * 100));
  const main = c.mode === 'stopwatch' ? 'Free focus' : c.mode === 'pomo' ? `Focus · ${c.pomoWork} min` : `Plant · ${SP[s.selected].min} min`;
  return (
    <Sheet open={open} onClose={onClose} title="Today">
      <div className="-mt-10"><Island list={list} seed={a / 1000} onPick={() => {}} /></div>
      <div className="-mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="glass rounded-2xl py-3"><div className="tnum flex items-center justify-center gap-1 text-xl font-semibold"><Flame size={16} className={streak ? 'text-orange-400' : 'text-white/30'} fill={streak ? 'currentColor' : 'none'} />{streak}</div><div className="mt-0.5 text-[11px] text-white/40">day streak</div></div>
        <div className="glass rounded-2xl py-3"><div className="tnum text-xl font-semibold text-emerald-300">{dur(today)}</div><div className="mt-0.5 text-[11px] text-white/40">of {dur(c.goal)} goal</div></div>
        <div className="glass rounded-2xl py-3"><div className="tnum flex items-center justify-center gap-1 text-xl font-semibold"><Sprout size={16} className="text-emerald-300" />{grown}</div><div className="mt-0.5 text-[11px] text-white/40">grown today</div></div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#34d399,#22d3ee)' }} /></div>
      <button onClick={() => onStart(null)} className="cta mt-5 h-14 w-full rounded-full text-lg font-semibold tracking-tight">{main}</button>
      <div className="mt-2.5 flex gap-2.5">
        {c.mode !== 'pomo' && <button onClick={() => onStart('pomo')} className="glass press flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium"><Timer size={16} /> Pomodoro · {c.pomoWork} min</button>}
        <button onClick={onGrove} className="glass press flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium"><Trees size={16} /> Open grove</button>
      </div>
    </Sheet>
  );
}
