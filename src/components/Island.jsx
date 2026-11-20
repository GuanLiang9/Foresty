import { useMemo } from 'react';
import Plant from './Plant';
import { cl, mulberry, tier } from '../lib/util';

const VW = 400, VH = 380, TOP = 120;
export const clock = (t) => new Date(t).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });

export function Island({ list, seed, sel, onPick }) {
  const shown = list.slice(-81);
  const n = cl(Math.ceil(Math.sqrt(shown.length)), 4, 9), A = 190 / n, B = A / 2;
  const { cells, decor } = useMemo(() => {
    const r = mulberry((seed % 2147483647) + n), c = [...Array(n * n).keys()];
    for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
    return { cells: c, decor: c.map(() => r()) };
  }, [seed, n]);
  const pos = (k) => { const i = k % n, j = Math.floor(k / n); return { i, j, x: 200 + (i - j) * A, y: TOP + (i + j + 1) * B }; };
  const plants = shown.map((ses, k) => ({ ses, ...pos(cells[k]) })).sort((p, q) => p.i + p.j - q.i - q.j);
  const used = new Set(cells.slice(0, shown.length));
  const mid = TOP + n * B, bot = TOP + 2 * n * B;
  return (
    <div className="pointer-events-none relative isolate mx-auto w-full max-w-sm" style={{ aspectRatio: `${VW}/${VH}` }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="dirtL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a3527" /><stop offset="1" stopColor="#120c09" /></linearGradient>
          <linearGradient id="dirtR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#33241b" /><stop offset="1" stopColor="#0c0806" /></linearGradient>
          <radialGradient id="halo"><stop offset="0" stopColor="#34d399" stopOpacity=".3" /><stop offset="1" stopColor="#34d399" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse cx="200" cy={mid + 30} rx="230" ry="130" fill="url(#halo)" />
        <path d={`M10 ${mid}L200 ${bot}V${bot + 44}L10 ${mid + 30}Z`} fill="url(#dirtL)" />
        <path d={`M390 ${mid}L200 ${bot}V${bot + 44}L390 ${mid + 30}Z`} fill="url(#dirtR)" />
        {[...Array(n * n).keys()].map((k) => {
          const { i, j, x, y } = pos(k);
          return <path key={k} d={`M${x} ${y - B}L${x + A} ${y}L${x} ${y + B}L${x - A} ${y}Z`} fill={(i + j) % 2 ? '#127a55' : '#0f6e4c'} stroke="#17946a" strokeWidth=".6" />;
        })}
        {[...Array(n * n).keys()].filter((k) => !used.has(k) && decor[k] < 0.3).map((k) => {
          const { x, y } = pos(k), v = decor[k];
          return v < 0.12
            ? <ellipse key={k} cx={x + (v - 0.06) * 80} cy={y} rx={A * 0.14} ry={A * 0.08} fill="#5b6b66" />
            : <g key={k} transform={`translate(${x} ${y})`} stroke="#6ee7b7" strokeWidth="1.6" strokeLinecap="round"><path d={`M-3 0l-2 -${A * 0.16}M0 0v-${A * 0.22}M3 0l2 -${A * 0.16}`} /></g>;
        })}
      </svg>
      {plants.map(({ ses, x, y, i, j }, idx) => {
        const w = A * 1.85 * tier(ses.secs / 60), h = w * 1.2;
        return (
          <button key={ses.id} onClick={() => onPick(ses)} className="anim-pop pointer-events-auto absolute" style={{ left: `${((x - w / 2) / VW) * 100}%`, top: `${((y - h * (222 / 240)) / VH) * 100}%`, width: `${(w / VW) * 100}%`, aspectRatio: '200/240', zIndex: i + j, animationDelay: `${Math.min(idx * 30, 900)}ms`, filter: sel === ses.id ? 'drop-shadow(0 0 10px rgba(167,243,208,.9))' : undefined }}>
            <Plant species={ses.species} g={ses.ok ? 1 : Math.max(0.6, ses.p ?? 0.6)} dead={!ses.ok} golden={ses.golden} lite className="h-full w-full" />
          </button>
        );
      })}
    </div>
  );
}

export function buckets(kind, a, b, ok) {
  const sum = (n, idx) => { const v = Array(n).fill(0); ok.forEach((x) => { const i = idx(new Date(x.end)); if (i >= 0 && i < n) v[i] += x.secs / 60; }); return v; };
  if (kind === 'range') {
    const n = Math.max(1, Math.min(31, Math.ceil((b - a) / 864e5)));
    return sum(n, (d) => Math.floor((+d - a) / 864e5)).map((m, i) => ({ m, l: n <= 10 || i % 5 === 0 ? `${i + 1}` : '' }));
  }
  if (kind === 'day') return sum(24, (d) => d.getHours()).map((m, i) => ({ m, l: i % 6 === 0 ? `${i}` : '' }));
  if (kind === 'week') return sum(7, (d) => (d.getDay() + 6) % 7).map((m, i) => ({ m, l: 'MTWTFSS'[i] }));
  if (kind === 'month') return sum(Math.round((b - a) / 864e5), (d) => d.getDate() - 1).map((m, i) => ({ m, l: i === 0 || (i + 1) % 5 === 0 ? `${i + 1}` : '' }));
  return sum(12, (d) => d.getMonth()).map((m, i) => ({ m, l: 'JFMAMJJASOND'[i] }));
}

export function Bars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.m));
  return (
    <div className="flex h-32 items-end gap-[3px]">
      {data.map((d, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <div className="w-full flex-1 overflow-hidden rounded-t-md rounded-b-sm bg-white/[.04]" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div className="w-full origin-bottom rounded-t-md" style={{ height: `${(d.m / max) * 100}%`, background: d.m === max ? 'linear-gradient(180deg,#a7f3d0,#22d3ee)' : 'linear-gradient(180deg,#34d399,#0f766e)', animation: `rise .7s cubic-bezier(.2,.8,.2,1) ${i * 18}ms both` }} />
          </div>
          <span className="h-3 text-[9px] leading-none text-white/35">{d.l}</span>
        </div>
      ))}
    </div>
  );
}
