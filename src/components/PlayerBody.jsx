import { useEffect, useState } from 'react';
import { Trees } from 'lucide-react';
import { DailyBars } from './Charts';
import { api } from '../lib/api';
import { recall, remember } from '../lib/cache';
import { dur } from '../lib/util';

const DAY = 864e5;
const midnight = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };

// The last `n` calendar days including today, as a window { from, to } in ms.
export const lastDays = (n) => {
  const a = midnight(Date.now()), b = midnight(Date.now());
  a.setDate(a.getDate() - (n - 1)); b.setDate(b.getDate() + 1);
  return { from: +a, to: +b, label: `Last ${n} days` };
};
// Calendar days a window touches (at most 31, which is all the API allows).
export const spanDays = (from, to) => Math.max(1, Math.min(31, Math.round((+midnight(to - 1) - +midnight(from)) / DAY) + 1));

// Any player's focus minutes per day over a window. The grove button only appears when the server says it may open.
export default function PlayerBody({ uid, win, onGrove }) {
  const { from, to } = win, key = `player:${uid}:${from}:${to}`;
  const [d, setD] = useState(() => recall(key)), [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setD(recall(key)); setErr('');
    api(`leaderboard?uid=${encodeURIComponent(uid)}&from=${from}&to=${to}&tz=${new Date().getTimezoneOffset()}`)
      .then((r) => live && setD(remember(key, r)))
      .catch((x) => live && !recall(key) && setErr(x.message));
    return () => { live = false; };
  }, [key, uid, from, to]);
  if (err) return <p className="py-8 text-center text-sm text-rose-300">{err}</p>;
  if (!d) return <p className="py-8 text-center text-sm text-white/40">Loading…</p>;
  return (
    <div className="anim-fade space-y-4">
      <p className="text-center text-sm text-white/55">{win.label}</p>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.25em] text-white/40">Focused</div>
          <div className="tnum mt-1 text-[44px] font-semibold leading-none tracking-tighter">{dur(d.minutes)}</div>
        </div>
        <div className="pb-1 text-right"><div className="tnum text-xl font-semibold text-emerald-300">{d.plants}</div><div className="text-[11px] text-white/40">plant{d.plants === 1 ? '' : 's'}</div></div>
      </div>
      <div className="glass rounded-3xl p-4">
        <div className="mb-3 text-xs font-medium text-white/50">Focus per day</div>
        <DailyBars days={d.daily} count={spanDays(from, to)} start={from} />
      </div>
      {d.minutes === 0 && <p className="text-center text-sm text-white/45">Nothing finished in this period yet.</p>}
      {d.canGrove
        ? <button onClick={onGrove} className="cta flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold"><Trees size={18} />View grove</button>
        : <p className="text-center text-xs text-white/35">Groves are only shared with friends and race mates.</p>}
    </div>
  );
}
