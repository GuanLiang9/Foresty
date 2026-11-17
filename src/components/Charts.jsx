import { dur } from '../lib/util';

// Daily focus minutes as bars. `days` = [{ day: 'YYYY-MM-DD', minutes }]; missing days show as empty bars.
export function DailyBars({ days, count }) {
  const byDay = Object.fromEntries(days.map((d) => [d.day, d.minutes]));
  const cells = [...Array(count)].map((_, i) => {
    const t = new Date(); t.setDate(t.getDate() - (count - 1 - i));
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return { key, minutes: byDay[key] || 0, label: 'SMTWTFS'[t.getDay()], today: i === count - 1 };
  });
  const max = Math.max(30, ...cells.map((c) => c.minutes));
  const W = 320, H = 110, gap = count > 14 ? 2 : 6, bw = (W - gap * (count - 1)) / count;
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Your focus minutes per day">
      <defs><linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
      {cells.map((c, i) => {
        const h = c.minutes ? Math.max(4, (c.minutes / max) * H) : 2;
        return (
          <g key={c.key}>
            <rect x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={Math.min(5, bw / 2)} fill={c.minutes ? 'url(#bar)' : 'rgba(255,255,255,.08)'} opacity={c.today || c.minutes ? 1 : 0.6} />
            {count <= 14 && <text x={i * (bw + gap) + bw / 2} y={H + 13} textAnchor="middle" fontSize="9" fill={c.today ? '#fff' : 'rgba(255,255,255,.35)'}>{c.label}</text>}
            <title>{`${c.key}: ${dur(c.minutes)}`}</title>
          </g>
        );
      })}
    </svg>
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
