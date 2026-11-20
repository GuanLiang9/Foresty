import { useCallback, useEffect, useRef, useState } from 'react';
import { Swords, Copy, Crown, Plus, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { Coin, Sheet, toast, input } from '../components/ui';
import { DailyBars } from '../components/Charts';
import PlayerBody, { lastDays } from '../components/PlayerBody';
import { GroveBody } from '../components/FriendGrove';
import { syncSessions } from '../lib/sync';
import { recall, remember } from '../lib/cache';
import { api } from '../lib/api';
import { dur } from '../lib/util';
import { addCoins, haptic, sfx } from '../store';

const DURATIONS = [[1, '1 day'], [3, '3 days'], [7, '1 week'], [14, '2 weeks'], [30, '1 month']];
// Must match rewardFor() in api/competitions.js (the server is what actually pays out).
const prize = (days) => Math.round((100 * days ** 0.75) / 10) * 10;
const left = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d}d ${h}h left` : h ? `${h}h ${m % 60}m left` : `${m}m left`; };
const boardUrl = (period) => `leaderboard?period=${period}&tz=${new Date().getTimezoneOffset()}`;

// The global board is just a race that never ends: same card, same standings sheet.
function BoardCard({ data, onOpen }) {
  const me = data?.me;
  return (
    <button onClick={onOpen} className="glass press flex w-full items-center gap-3 rounded-3xl p-4 text-left">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><Globe size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">Everyone</span>
        <span className="mt-0.5 block text-xs text-white/45">Last 7 days · open to all</span>
      </span>
      <span className="text-right text-xs text-white/50">{me ? <>You <b className="tnum text-white">#{me.rank}</b><span className="tnum block text-white/40">{dur(me.minutes)}</span></> : 'Finish a session to join'}</span>
    </button>
  );
}

function RaceCard({ c, onOpen }) {
  const status = c.ended ? (c.won ? (c.claimed ? 'You won · claimed' : 'You won!') : 'Finished') : left(new Date(c.endsAt) - Date.now());
  return (
    <button onClick={onOpen} className="glass press flex w-full items-center gap-3 rounded-3xl p-4 text-left">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${c.won && !c.claimed ? 'bg-amber-300/20 text-amber-300' : 'bg-white/10 text-white/60'}`}>{c.won ? <Crown size={20} /> : <Swords size={19} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{c.name}</span>
        <span className="mt-0.5 block text-xs text-white/45">{status} · {c.members} player{c.members === 1 ? '' : 's'}</span>
      </span>
      <span className="text-right text-xs text-white/50">{c.myRank ? <>You <b className="tnum text-white">#{c.myRank}</b></> : null}<span className="mt-0.5 flex items-center justify-end gap-1 text-amber-200"><Coin size={12} />{c.reward}</span></span>
    </button>
  );
}

// One ranked list for both the board and races. Every row opens that player's daily graph.
function StandingsList({ rows, onPick, ended }) {
  const top = rows[0]?.minutes || 0;
  return (
    <ol className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.uid}>
          <button onClick={() => onPick(r)} className={`press flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${r.me ? 'bg-emerald-400/15 ring-1 ring-emerald-300/30' : 'bg-white/[.04]'}`}>
            <span className={`tnum w-6 text-center text-sm font-semibold ${r.rank <= 3 ? 'text-amber-300' : 'text-white/40'}`}>{r.rank}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}{r.me && <span className="text-emerald-300"> · you</span>}<span className="block text-[11px] font-normal text-white/40">{r.plants} plant{r.plants === 1 ? '' : 's'}{r.rank > 1 && top > r.minutes ? ` · −${dur(top - r.minutes)}` : ''}</span><span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[.08]"><span className="block h-full rounded-full" style={{ width: `${Math.max(r.minutes ? 3 : 0, (r.minutes / Math.max(1, top)) * 100)}%`, background: r.me ? 'linear-gradient(90deg,#34d399,#22d3ee)' : 'rgba(255,255,255,.35)' }} /></span></span>
            {ended && r.leader && <Crown size={15} className="text-amber-300" />}
            <span className="tnum text-sm">{dur(r.minutes)}</span>
            <ChevronRight size={15} className="text-white/25" />
          </button>
        </li>
      ))}
    </ol>
  );
}

function BoardBody({ period, setPeriod, onPick }) {
  const [data, setData] = useState(() => recall(`lb:${period}`)), [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setErr(''); setData(recall(`lb:${period}`));
    syncSessions().then(() => api(boardUrl(period)))
      .then((d) => live && setData(remember(`lb:${period}`, d)))
      .catch((x) => live && !recall(`lb:${period}`) && setErr(x.message)); // offline with an old copy: keep showing it
    return () => { live = false; };
  }, [period]);
  const n = period === 'week' ? 7 : 30;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 rounded-full bg-white/[.06] p-1 text-sm">
        {[['week', 'This week'], ['month', '30 days']].map(([k, l]) => <button key={k} onClick={() => setPeriod(k)} className={`h-9 rounded-full font-medium transition-colors ${period === k ? 'bg-white/15 text-white' : 'text-white/45'}`}>{l}</button>)}
      </div>
      {err && <p className="py-6 text-center text-sm text-rose-300">{err}</p>}
      {!err && !data && <p className="py-6 text-center text-sm text-white/40">Loading…</p>}
      {data && (
        <>
          <div className="glass anim-rise rounded-3xl p-4">
            <div className="flex items-end justify-between">
              <div><div className="text-[11px] font-semibold uppercase tracking-[.2em] text-emerald-300">Your focus</div><div className="tnum mt-1 text-3xl font-semibold tracking-tighter">{dur(data.daily.reduce((a, d) => a + d.minutes, 0))}</div></div>
              {data.me ? <div className="text-right text-sm text-white/55">Rank <b className="tnum text-white">#{data.me.rank}</b><br />{data.me.plants} plant{data.me.plants === 1 ? '' : 's'}</div> : <div className="text-right text-xs text-white/40">Finish a session<br />to join the board</div>}
            </div>
            <div className="mt-3"><DailyBars days={data.daily} count={n} /></div>
          </div>
          {data.top.length > 0 && (
            <div className="glass anim-rise space-y-4 rounded-3xl p-4" style={{ animationDelay: '.05s' }}>
              <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-white/45">Top growers</div>
              <StandingsList rows={data.top} onPick={(r) => onPick(r, lastDays(n))} />
              {data.me && !data.top.some((r) => r.me) && <p className="tnum text-center text-sm text-white/55">You are #{data.me.rank} with {dur(data.me.minutes)}</p>}
              <p className="text-center text-xs text-white/35">Tap a player to see their focus per day</p>
            </div>
          )}
          {!data.top.length && <p className="py-6 text-center text-sm text-white/45">No one has finished a session yet. Grow a tree to take first place.</p>}
        </>
      )}
    </div>
  );
}

function RaceBody({ id, onPick, onChange }) {
  const [d, setD] = useState(() => recall(`race:${id}`)), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(() => syncSessions().then(() => api(`competitions?op=get&id=${id}`)).then((r) => setD(remember(`race:${id}`, r)))
    .catch((x) => !recall(`race:${id}`) && setErr(x.message)), [id]);
  useEffect(() => { setD(recall(`race:${id}`)); setErr(''); load(); }, [id, load]);
  const c = d?.competition;
  const claim = async () => {
    setBusy(true);
    try {
      const r = await api('competitions?op=claim', { method: 'POST', body: { id } });
      if (r.coins) { addCoins(r.coins); sfx('done'); haptic([20, 40, 60]); toast(`Winner! +${r.coins} coins`); }
      await load(); onChange();
    } catch (x) { toast(x.message); }
    setBusy(false);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(c.code); toast('Code copied'); } catch { toast(`Code: ${c.code}`); } };
  if (err) return <p className="py-6 text-center text-sm text-rose-300">{err}</p>;
  if (!c) return <p className="py-6 text-center text-sm text-white/40">Loading…</p>;
  const win = { from: +new Date(c.startsAt), to: +new Date(c.endsAt), label: `${c.name} · race window` };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/55">{c.ended ? 'Finished' : left(new Date(c.endsAt) - Date.now())}</span>
        <span className="flex items-center gap-1.5 text-amber-200"><Coin size={14} /> Winner gets {c.reward}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[.08]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300 transition-all duration-700" style={{ width: `${c.ended ? 100 : Math.max(2, Math.min(100, ((Date.now() - win.from) / (win.to - win.from)) * 100))}%` }} /></div>
      {!c.ended && (
        <button onClick={copy} className="press flex w-full items-center justify-between rounded-2xl bg-white/[.07] px-4 py-3 text-left">
          <span><span className="block text-[11px] uppercase tracking-[.2em] text-white/40">Invite code</span><span className="tnum text-2xl font-semibold tracking-[.25em]">{c.code}</span></span>
          <Copy size={18} className="text-white/50" />
        </button>
      )}
      <StandingsList rows={d.standings} ended={c.ended} onPick={(r) => onPick(r, win)} />
      {c.ended && c.won && !c.claimed && <button disabled={busy} onClick={claim} className="cta h-12 w-full rounded-full font-semibold disabled:opacity-50">Claim {c.reward} coins</button>}
      {c.ended && c.won && c.claimed && <p className="text-center text-sm text-emerald-300">Reward claimed. Well played!</p>}
      {c.ended && !c.won && <p className="text-center text-sm text-white/45">{c.leader ? `${c.leader} won this one.` : 'Nobody focused this time.'}</p>}
      {!c.ended && <p className="text-center text-xs text-white/35">Every finished session counts. The most focus time when the timer ends wins.</p>}
      <p className="text-center text-xs text-white/35">Tap a player to see their focus per day</p>
    </div>
  );
}

// One sheet for everything under Compete. Tapping a player goes one level deeper (graph, then grove) with a Back
// button, so there is only ever one sheet and one history entry.
function CompeteSheet({ target, onClose, onChange }) {
  const [stack, setStack] = useState([]), [period, setPeriod] = useState('week');
  const last = useRef(target);
  if (target) last.current = target;
  const t = target || last.current;
  useEffect(() => { setStack([]); }, [target?.kind, target?.id]);
  const top = stack[stack.length - 1];
  const push = (f) => setStack((s) => [...s, f]);
  const pick = (r, win) => push({ t: 'player', uid: r.uid, name: r.me ? 'You' : r.name, me: r.me, win });
  const title = top ? (top.t === 'grove' ? (top.me ? 'Your grove' : `${top.name}'s grove`) : top.name) : t?.kind === 'board' ? 'Everyone' : t?.name || 'Race';
  return (
    <Sheet open={!!target} onClose={onClose} title={title}>
      {top && <button onClick={() => setStack((s) => s.slice(0, -1))} className="press -mt-1 mb-3 flex items-center gap-1 text-sm text-white/55"><ChevronLeft size={16} />Back</button>}
      {top?.t === 'player' && <PlayerBody uid={top.uid} win={top.win} onGrove={() => push({ ...top, t: 'grove' })} />}
      {top?.t === 'grove' && <GroveBody uid={top.uid} fixed={{ a: top.win.from, b: top.win.to, label: top.win.label }} />}
      {!top && t?.kind === 'board' && <BoardBody period={period} setPeriod={setPeriod} onPick={pick} />}
      {!top && t?.kind === 'race' && <RaceBody id={t.id} onPick={pick} onChange={onChange} />}
    </Sheet>
  );
}

export default function Compete() {
  const [list, setList] = useState(() => recall('races')), [board, setBoard] = useState(() => recall('lb:week')), [err, setErr] = useState(''), [target, setTarget] = useState(null);
  const [form, setForm] = useState(false), [name, setName] = useState(''), [days, setDays] = useState(7), [code, setCode] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(() => syncSessions().then(() => Promise.all([
    api('competitions?op=list').then((r) => { setList(remember('races', r.competitions)); setErr(''); }).catch((x) => !recall('races') && setErr(x.message)),
    api(boardUrl('week')).then((d) => setBoard(remember('lb:week', d))).catch(() => {}),
  ])), []);
  useEffect(() => { load(); }, [load]);
  const go = async (fn) => { setBusy(true); try { const r = await fn(); await load(); if (r?.competition) { setTarget({ kind: 'race', id: r.competition.id, name: r.competition.name }); setForm(false); setName(''); setCode(''); } } catch (x) { toast(x.message); } setBusy(false); };
  const create = (e) => { e.preventDefault(); go(() => api('competitions?op=create', { method: 'POST', body: { name, days } })); };
  const join = (e) => { e.preventDefault(); go(() => api('competitions?op=join', { method: 'POST', body: { code } })); };
  const winning = list?.filter((c) => c.won && !c.claimed).length || 0;
  return (
    <div className="mt-4 space-y-3">
      {winning > 0 && <div className="glass anim-rise rounded-3xl bg-amber-300/10 p-4 text-sm text-amber-100">You have {winning} prize{winning > 1 ? 's' : ''} waiting. Open the race to claim it.</div>}
      <BoardCard data={board} onOpen={() => setTarget({ kind: 'board' })} />
      {err && <p className="py-4 text-center text-sm text-rose-300">{err}</p>}
      {!err && !list && <p className="py-4 text-center text-sm text-white/40">Loading…</p>}
      {list?.map((c) => <RaceCard key={c.id} c={c} onOpen={() => setTarget({ kind: 'race', id: c.id, name: c.name })} />)}
      {list?.length === 0 && <p className="py-2 text-center text-sm text-white/45">No races yet. Start one and share the code with friends.</p>}
      <form onSubmit={join} className="flex gap-2 pt-1">
        <input className={`${input} tracking-[.2em] uppercase`} placeholder="Invite code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} />
        <button disabled={busy || code.length < 4} className="press h-12 shrink-0 rounded-full bg-white/10 px-5 text-sm font-semibold disabled:opacity-40">Join</button>
      </form>
      {!form ? (
        <button onClick={() => setForm(true)} className="cta flex h-12 w-full items-center justify-center gap-2 rounded-full font-semibold"><Plus size={18} />Start a race</button>
      ) : (
        <form onSubmit={create} className="glass anim-rise space-y-3 rounded-3xl p-4">
          <input className={input} placeholder="Name (e.g. Study squad)" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <div className="mb-2 text-xs text-white/45">How long should it run?</div>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(([n, l]) => <button type="button" key={n} onClick={() => setDays(n)} className={`press h-10 rounded-full px-4 text-sm font-medium ${days === n ? 'bg-emerald-400 text-black' : 'bg-white/10 text-white/70'}`}>{l}</button>)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-amber-200"><Coin size={14} />Winner gets {prize(days)} coins</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(false)} className="press h-12 rounded-full bg-white/10 px-5 text-sm font-medium">Cancel</button>
            <button disabled={busy} className="cta h-12 flex-1 rounded-full font-semibold disabled:opacity-50">{busy ? 'Starting…' : 'Start now'}</button>
          </div>
        </form>
      )}
      <CompeteSheet target={target} onClose={() => setTarget(null)} onChange={load} />
    </div>
  );
}
