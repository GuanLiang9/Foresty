import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Sparkles } from 'lucide-react';
import Plant from '../components/Plant';
import { SP } from '../data';
import { cl, dur, mulberry, tier } from '../lib/util';
import { useStore, periodRange, deleteSession } from '../store';

const KINDS = ['day', 'week', 'month', 'year'];
const VW = 400, VH = 380, TOP = 120;
const clock = (t) => new Date(t).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });

function Island({ list, seed, sel, onPick }) {
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
    <div className="relative mx-auto w-full max-w-sm" style={{ aspectRatio: `${VW}/${VH}` }}>
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
          <button key={ses.id} onClick={() => onPick(ses)} className="anim-pop absolute" style={{ left: `${((x - w / 2) / VW) * 100}%`, top: `${((y - h * (222 / 240)) / VH) * 100}%`, width: `${(w / VW) * 100}%`, aspectRatio: '200/240', zIndex: i + j, animationDelay: `${Math.min(idx * 30, 900)}ms`, filter: sel === ses.id ? 'drop-shadow(0 0 10px rgba(167,243,208,.9))' : undefined }}>
            <Plant species={ses.species} g={ses.ok ? 1 : Math.max(0.6, ses.p ?? 0.6)} dead={!ses.ok} golden={ses.golden} lite className="h-full w-full" />
          </button>
        );
      })}
    </div>
  );
}

function buckets(kind, a, b, ok) {
  const sum = (n, idx) => { const v = Array(n).fill(0); ok.forEach((x) => { const i = idx(new Date(x.end)); if (i >= 0 && i < n) v[i] += x.secs / 60; }); return v; };
  if (kind === 'day') return sum(24, (d) => d.getHours()).map((m, i) => ({ m, l: i % 6 === 0 ? `${i}` : '' }));
  if (kind === 'week') return sum(7, (d) => (d.getDay() + 6) % 7).map((m, i) => ({ m, l: 'MTWTFSS'[i] }));
  if (kind === 'month') return sum(Math.round((b - a) / 864e5), (d) => d.getDate() - 1).map((m, i) => ({ m, l: i === 0 || (i + 1) % 5 === 0 ? `${i + 1}` : '' }));
  return sum(12, (d) => d.getMonth()).map((m, i) => ({ m, l: 'JFMAMJJASOND'[i] }));
}

function Bars({ data }) {
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

function Donut({ parts, total }) {
  const C = 2 * Math.PI * 40;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90">
      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="11" />
      {parts.map((p) => {
        const len = (p.m / total) * C, off = acc;
        acc += len;
        return <circle key={p.id} cx="50" cy="50" r="40" fill="none" stroke={p.color} strokeWidth="11" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-off} />;
      })}
    </svg>
  );
}

export default function Grove({ go }) {
  const s = useStore();
  const [kind, setKind] = useState('day'), [off, setOff] = useState(0), [sel, setSel] = useState(null), [confirm, setConfirm] = useState(false);
  const { a, b, label } = useMemo(() => periodRange(kind, off), [kind, off]);
  const list = useMemo(() => s.sessions.filter((x) => x.end >= a && x.end < b), [s.sessions, a, b]);
  const ok = list.filter((x) => x.ok), minutes = ok.reduce((n, x) => n + x.secs, 0) / 60, dead = list.length - ok.length;
  const tagOf = (id) => s.tags.find((t) => t.id === id) || { id, name: 'Other', color: '#94a3b8' };
  const parts = Object.values(ok.reduce((m, x) => { const t = tagOf(x.tag); (m[t.id] ??= { ...t, m: 0 }).m += x.secs / 60; return m; }, {})).sort((p, q) => q.m - p.m);
  const picked = list.find((x) => x.id === sel);
  const pick = (x) => { setSel(x.id === sel ? null : x.id); setConfirm(false); };
  const shift = (d) => { setOff((o) => Math.min(0, o + d)); setSel(null); };

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-5 pb-32 pt-[calc(env(safe-area-inset-top)+14px)]">
      <h1 className="anim-rise text-[34px] font-semibold leading-none tracking-tighter">Your grove</h1>

      <div className="glass anim-rise relative mt-5 grid grid-cols-4 rounded-full p-1 text-sm font-medium" style={{ animationDelay: '.05s' }}>
        <span className="absolute inset-y-1 left-1 w-[calc(25%-2px)] rounded-full bg-white/[.12] transition-transform duration-500" style={{ transform: `translateX(${KINDS.indexOf(kind) * 100}%)`, transitionTimingFunction: 'cubic-bezier(.3,1.4,.5,1)' }} />
        {KINDS.map((k) => <button key={k} onClick={() => { setKind(k); setOff(0); setSel(null); }} className={`relative z-10 py-1.5 capitalize transition-colors ${k === kind ? 'text-white' : 'text-white/45'}`}>{k}</button>)}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button aria-label="Previous" onClick={() => shift(-1)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/5"><ChevronLeft size={18} /></button>
        <span className="text-sm font-medium text-white/70">{label}</span>
        <button aria-label="Next" onClick={() => shift(1)} disabled={off === 0} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/5 disabled:opacity-25"><ChevronRight size={18} /></button>
      </div>

      <div key={`${kind}${off}`} className="anim-fade -mt-6">
        <Island list={list} seed={a / 1000} sel={sel} onPick={pick} />
      </div>

      {picked ? (
        <div key={picked.id} className="glass anim-rise -mt-2 flex items-center gap-3 rounded-3xl p-3 pr-4">
          <Plant species={picked.species} dead={!picked.ok} golden={picked.golden} g={picked.ok ? 1 : Math.max(0.6, picked.p ?? 0.6)} sway={false} lite className="h-16 w-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-semibold">{SP[picked.species].name}{picked.golden && <Sparkles size={14} className="text-amber-300" />}{!picked.ok && <span className="text-xs font-medium text-rose-300/80">withered</span>}</div>
            <div className="mt-0.5 text-xs text-white/50">{dur(picked.secs / 60)} · {clock(picked.start)}–{clock(picked.end)} · <span style={{ color: tagOf(picked.tag).color }}>{tagOf(picked.tag).name}</span></div>
            {picked.note && <div className="mt-0.5 truncate text-xs text-white/40">“{picked.note}”</div>}
          </div>
          <button onClick={() => (confirm ? (deleteSession(picked.id), setSel(null)) : setConfirm(true))} className={`press flex h-9 items-center justify-center rounded-full px-3 text-xs ${confirm ? 'bg-rose-500/30 text-rose-200' : 'bg-white/5 text-white/40'}`}>{confirm ? 'Remove?' : <Trash2 size={15} />}</button>
        </div>
      ) : list.length === 0 ? (
        <div className="anim-rise -mt-2 text-center">
          <p className="text-sm text-white/50">Bare soil. Nothing planted {kind === 'day' && off === 0 ? 'yet today' : 'in this period'}.</p>
          {off === 0 && <button onClick={() => go('focus')} className="cta mt-4 h-12 rounded-full px-7 text-sm font-semibold">Plant the first one</button>}
        </div>
      ) : (
        <p className="-mt-2 text-center text-xs text-white/35">{list.length > 81 ? `Showing the latest 81 of ${list.length} · ` : ''}Tap a plant for its story</p>
      )}

      {list.length > 0 && (
        <>
          <div className="anim-rise mt-7 flex items-end justify-between" style={{ animationDelay: '.1s' }}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[.25em] text-white/40">Focused</div>
              <div className="tnum mt-1 text-[52px] font-semibold leading-none tracking-tighter">{dur(minutes)}</div>
            </div>
            <div className="flex gap-5 pb-1 text-right">
              <div><div className="tnum text-xl font-semibold text-emerald-300">{ok.length}</div><div className="text-[11px] text-white/40">grown</div></div>
              <div><div className="tnum text-xl font-semibold text-white/50">{dead}</div><div className="text-[11px] text-white/40">withered</div></div>
              <div><div className="tnum text-xl font-semibold">{Math.round((ok.length / list.length) * 100)}%</div><div className="text-[11px] text-white/40">kept</div></div>
            </div>
          </div>

          <div key={`b${kind}${off}`} className="glass anim-rise mt-5 rounded-3xl p-4" style={{ animationDelay: '.15s' }}>
            <div className="mb-3 text-xs font-medium text-white/50">When you focus</div>
            <Bars data={buckets(kind, a, b, ok)} />
          </div>

          {parts.length > 0 && (
            <div className="glass anim-rise mt-3 flex items-center gap-5 rounded-3xl p-4" style={{ animationDelay: '.2s' }}>
              <Donut parts={parts} total={minutes} />
              <div className="min-w-0 flex-1 space-y-2">
                {parts.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="tnum text-white/50">{dur(p.m)}</span>
                    <span className="tnum w-9 text-right text-xs text-white/30">{Math.round((p.m / minutes) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 text-[11px] font-semibold uppercase tracking-[.25em] text-white/40">Timeline</div>
          <div className="mt-2">
            {[...list].reverse().slice(0, 60).map((x) => (
              <button key={x.id} onClick={() => pick(x)} className="flex w-full items-center gap-3 border-b border-white/5 py-2.5 text-left">
                <Plant species={x.species} dead={!x.ok} golden={x.golden} g={x.ok ? 1 : Math.max(0.6, x.p ?? 0.6)} sway={false} lite className="h-11 w-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{x.note || SP[x.species].name}</div>
                  <div className="text-xs text-white/40">{kind !== 'day' && `${new Date(x.end).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })} · `}{clock(x.start)} · {tagOf(x.tag).name}</div>
                </div>
                <span className={`tnum text-sm ${x.ok ? 'text-white/70' : 'text-rose-300/70 line-through'}`}>{dur(x.secs / 60)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
