import { useEffect, useState } from 'react';
import { dur } from '../lib/util';

const dk = (t) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

// One cell per day: the last `count` days ending today, or `count` days from `start` (ms) when given (a race window).
function dayCells(days, count, start) {
  const byDay = Object.fromEntries(days.map((d) => [d.day, d.minutes]));
  const todayKey = dk(new Date());
  return [...Array(count)].map((_, i) => {
    const t = start == null ? new Date() : new Date(start);
    t.setDate(t.getDate() + (start == null ? -(count - 1 - i) : i));
    const key = dk(t);
    return { key, date: t, minutes: byDay[key] || 0, label: 'SMTWTFS'[t.getDay()], today: key === todayKey };
  });
}

// Daily focus minutes as bars. `days` = [{ day: 'YYYY-MM-DD', minutes }]; missing days show as empty bars.
// With `onSelect`, every column is tappable and the `selected` day is highlighted while the others dim.
export function DailyBars({ days, count, start, selected, onSelect }) {
  const cells = dayCells(days, count, start);
  const max = Math.max(30, ...cells.map((c) => c.minutes));
  const W = 320, H = 110, gap = count > 14 ? 2 : 6, bw = (W - gap * (count - 1)) / count, pick = !!onSelect;
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full select-none" role="img" aria-label="Focus minutes per day">
      <defs><linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
      {cells.map((c, i) => {
        const h = c.minutes ? Math.max(4, (c.minutes / max) * H) : 2, x = i * (bw + gap), on = c.key === selected;
        return (
          <g key={c.key} onClick={pick ? () => onSelect(c.key) : undefined} style={pick ? { cursor: 'pointer' } : undefined} role={pick ? 'button' : undefined} aria-label={pick ? `${c.key}: ${dur(c.minutes)}` : undefined}>
            {pick && on && <rect x={x - gap / 2} y={0} width={bw + gap} height={H + 18} rx={6} fill="rgba(255,255,255,.07)" />}
            <rect x={x} y={H - h} width={bw} height={h} rx={Math.min(5, bw / 2)} fill={c.minutes ? 'url(#bar)' : 'rgba(255,255,255,.08)'} opacity={pick ? (on ? 1 : 0.4) : c.today || c.minutes ? 1 : 0.6} style={{ transition: 'opacity .25s' }} />
            {count <= 14 && <text x={x + bw / 2} y={H + 13} textAnchor="middle" fontSize="9" fontWeight={on ? 700 : 400} fill={on || (!pick && c.today) ? '#fff' : 'rgba(255,255,255,.35)'}>{c.label}</text>}
            {pick && <rect x={x - gap / 2} y={0} width={bw + gap} height={H + 18} fill="transparent" />}
            <title>{`${c.key}: ${dur(c.minutes)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

// The chart plus a readout for the tapped day. Starts on the most recent day with focus.
export function DayChart({ days, count, start }) {
  const cells = dayCells(days, count, start);
  const pickDefault = () => { const used = cells.filter((c) => c.minutes > 0); return (used.length ? used[used.length - 1] : cells[cells.length - 1]).key; };
  const sig = `${start}|${count}|${days.map((d) => `${d.day}:${d.minutes}`).join(',')}`;
  const [sel, setSel] = useState(pickDefault);
  useEffect(() => { setSel(pickDefault()); }, [sig]);
  const cur = cells.find((c) => c.key === sel) || cells[cells.length - 1];
  return (
    <div>
      <div key={cur.key} className="anim-fade mb-3 flex items-baseline justify-between">
        <span className="text-sm text-white/55">{cur.today ? 'Today' : cur.date.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <span className={`tnum text-2xl font-semibold tracking-tight ${cur.minutes ? '' : 'text-white/35'}`}>{cur.minutes ? dur(cur.minutes) : 'No focus'}</span>
      </div>
      <DailyBars days={days} count={count} start={start} selected={cur.key} onSelect={setSel} />
    </div>
  );
}

// Horizontal bars comparing players. rows = [{ name, minutes, me }].
export function RaceBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="mb-1 flex justify-between text-xs"><span className={`truncate ${r.me ? 'text-emerald-300' : 'text-white/70'}`}>{r.name}{r.me ? ' · you' : ''}</span><span className="tnum text-white/50">{dur(r.minutes)}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[.08]"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(r.minutes ? 3 : 0, (r.minutes / max) * 100)}%`, background: r.me ? 'linear-gradient(90deg,#34d399,#22d3ee)' : 'rgba(255,255,255,.35)' }} /></div>
        </div>
      ))}
    </div>
  );
}
