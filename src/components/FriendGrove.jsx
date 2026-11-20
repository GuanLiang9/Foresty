import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import Plant from './Plant';
import { Sheet } from './ui';
import { Island, Bars, buckets, clock } from './Island';
import { SP } from '../data';
import { api } from '../lib/api';
import { recall, remember } from '../lib/cache';
import { dur } from '../lib/util';
import { periodRange } from '../store';

const KINDS = ['day', 'week', 'month'];

// Read-only view of another player's grove. `fixed` = { a, b, label } pins the window (used by races);
// otherwise the viewer can flip between day / week / month.
export default function FriendGrove({ who, onClose, fixed }) {
  const [kind, setKind] = useState('week'), [off, setOff] = useState(0), [sel, setSel] = useState(null);
  const [data, setData] = useState(null), [err, setErr] = useState('');
  const range = useMemo(() => (fixed ? { a: fixed.a, b: fixed.b, label: fixed.label } : periodRange(kind, off)), [fixed, kind, off]);
  const { a, b, label } = range, uid = who?.uid;
  const key = `grove:${uid}:${a}:${b}`;

  useEffect(() => { setKind('week'); setOff(0); setSel(null); }, [uid]);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    setData(recall(key)); setErr(''); setSel(null);
    api(`friends?op=grove&uid=${encodeURIComponent(uid)}&a=${a}&b=${b}`)
      .then((d) => live && setData(remember(key, d)))
      .catch((x) => live && !recall(key) && setErr(x.message));
    return () => { live = false; };
  }, [uid, a, b, key]);

  const list = data?.sessions || [];
  const ok = list.filter((x) => x.ok !== false), minutes = ok.reduce((n, x) => n + x.secs, 0) / 60, dead = list.length - ok.length;
  const picked = list.find((x) => x.id === sel);

  return (
    <Sheet open={!!who} onClose={onClose} title={`${who?.name || ''}'s grove`}>
      {!fixed && (
        <>
          <div className="grid grid-cols-3 rounded-full bg-white/[.06] p-1 text-sm font-medium">
            {KINDS.map((k) => <button key={k} onClick={() => { setKind(k); setOff(0); }} className={`h-9 rounded-full capitalize transition-colors ${k === kind ? 'bg-white/15 text-white' : 'text-white/45'}`}>{k}</button>)}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button aria-label="Previous" onClick={() => setOff((o) => o - 1)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/5"><ChevronLeft size={18} /></button>
            <span className="text-sm font-medium text-white/70">{label}</span>
            <button aria-label="Next" onClick={() => setOff((o) => Math.min(0, o + 1))} disabled={off === 0} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/5 disabled:opacity-25"><ChevronRight size={18} /></button>
          </div>
        </>
      )}
      {fixed && <p className="text-center text-sm text-white/55">{label}</p>}

      {err && <p className="py-8 text-center text-sm text-rose-300">{err}</p>}
      {!err && !data && <p className="py-8 text-center text-sm text-white/40">Loading…</p>}
      {data && (
        <div className="anim-fade">
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[.25em] text-white/40">Focused</div>
              <div className="tnum mt-1 text-[44px] font-semibold leading-none tracking-tighter">{dur(minutes)}</div>
            </div>
            <div className="flex gap-5 pb-1 text-right">
              <div><div className="tnum text-xl font-semibold text-emerald-300">{ok.length}</div><div className="text-[11px] text-white/40">grown</div></div>
              <div><div className="tnum text-xl font-semibold text-white/50">{dead}</div><div className="text-[11px] text-white/40">withered</div></div>
            </div>
          </div>

          <div className="-mt-2"><Island list={list} seed={a / 1000} sel={sel} onPick={(x) => setSel(x.id === sel ? null : x.id)} /></div>

          {picked ? (
            <div className="glass -mt-2 flex items-center gap-3 rounded-3xl p-3 pr-4">
              <Plant species={picked.species} dead={picked.ok === false} golden={picked.golden} g={picked.ok === false ? Math.max(0.6, picked.p ?? 0.6) : 1} sway={false} lite className="h-16 w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-semibold">{SP[picked.species]?.name || 'Plant'}{picked.golden && <Sparkles size={14} className="text-amber-300" />}{picked.ok === false && <span className="text-xs font-medium text-rose-300/80">withered</span>}</div>
                <div className="mt-0.5 text-xs text-white/50">{dur(picked.secs / 60)} · {clock(picked.start)}–{clock(picked.end)}</div>
              </div>
            </div>
          ) : list.length === 0 ? (
            <p className="-mt-2 text-center text-sm text-white/50">Bare soil. Nothing planted in this period.</p>
          ) : (
            <p className="-mt-2 text-center text-xs text-white/35">Tap a plant for its story</p>
          )}

          {ok.length > 0 && (
            <div className="glass mt-5 rounded-3xl p-4">
              <div className="mb-3 text-xs font-medium text-white/50">{fixed ? 'Focus per day of the race' : 'When they focus'}</div>
              <Bars data={buckets(fixed ? 'range' : kind, a, b, ok)} />
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
