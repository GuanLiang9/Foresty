import { useCallback, useEffect, useState } from 'react';
import { Trophy, Swords, Copy, LogOut, Crown, Plus } from 'lucide-react';
import { Coin, Sheet, toast } from '../components/ui';
import { DailyBars, RaceBars } from '../components/Charts';
import { useAccount, signIn, signUp, signOut } from '../lib/auth';
import { syncSessions, signOutSynced } from '../lib/sync';
import { api } from '../lib/api';
import { dur } from '../lib/util';
import { addCoins, haptic, sfx } from '../store';

const input = 'h-12 w-full rounded-2xl bg-white/[.07] px-4 text-[15px] outline-none ring-emerald-300/50 placeholder:text-white/30 focus:ring-2';
const DURATIONS = [[1, '1 day'], [3, '3 days'], [7, '1 week'], [14, '2 weeks'], [30, '1 month']];
// Must match rewardFor() in api/competitions.js (the server is what actually pays out).
const prize = (days) => Math.round((100 * days ** 0.75) / 10) * 10;

function SignInForm() {
  const [mode, setMode] = useState('in'), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      if (mode === 'up') await signUp(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      toast(mode === 'up' ? 'Welcome to the leaderboard' : 'Signed in');
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="glass anim-rise mt-5 space-y-3 rounded-3xl p-5">
      <p className="text-sm leading-relaxed text-white/55">Sign in to climb the leaderboard and race friends. Your plants, history and coins are saved to your account and sync to every device you sign in on. The leaderboard only sees finished sessions from the past week.</p>
      {mode === 'up' && <input className={input} placeholder="Display name" maxLength={24} required value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />}
      <input className={input} type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input className={input} type="password" placeholder="Password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
      {err && <p className="text-sm text-rose-300">{err}</p>}
      <button disabled={busy} className="cta h-12 w-full rounded-full font-semibold disabled:opacity-50">{busy ? 'One moment…' : mode === 'up' ? 'Create account' : 'Sign in'}</button>
      <button type="button" onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setErr(''); }} className="w-full py-2 text-sm text-white/55">{mode === 'up' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
    </form>
  );
}

function Leaderboard() {
  const [period, setPeriod] = useState('week'), [data, setData] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setErr('');
    syncSessions().then(() => api(`leaderboard?period=${period}&tz=${new Date().getTimezoneOffset()}`))
      .then((d) => live && setData(d)).catch((x) => live && setErr(x.message));
    return () => { live = false; };
  }, [period]);
  const n = period === 'week' ? 7 : 30;
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 rounded-full bg-white/[.06] p-1 text-sm">
        {[['week', 'This week'], ['month', '30 days']].map(([k, l]) => <button key={k} onClick={() => { setPeriod(k); setData(null); }} className={`h-9 rounded-full font-medium transition-colors ${period === k ? 'bg-white/15 text-white' : 'text-white/45'}`}>{l}</button>)}
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
            <div className="glass anim-rise rounded-3xl p-4" style={{ animationDelay: '.05s' }}>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.2em] text-white/45">Top growers</div>
              <RaceBars rows={data.top.slice(0, 5)} />
              <ol className="mt-4 space-y-1.5">
                {data.top.map((r, i) => (
                  <li key={i} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${r.me ? 'bg-emerald-400/15 ring-1 ring-emerald-300/30' : 'bg-white/[.04]'}`}>
                    <span className={`tnum w-6 text-center text-sm font-semibold ${r.rank <= 3 ? 'text-amber-300' : 'text-white/40'}`}>{r.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}{r.me && <span className="text-emerald-300"> · you</span>}</span>
                    <span className="tnum text-right text-sm">{dur(r.minutes)}<span className="block text-[11px] text-white/40">{r.plants} plant{r.plants === 1 ? '' : 's'}</span></span>
                  </li>
                ))}
              </ol>
              {data.me && !data.top.some((r) => r.me) && <p className="tnum mt-3 text-center text-sm text-white/55">You are #{data.me.rank} with {dur(data.me.minutes)}</p>}
            </div>
          )}
          {!data.top.length && <p className="py-6 text-center text-sm text-white/45">No one has finished a session yet. Grow a tree to take first place.</p>}
        </>
      )}
    </div>
  );
}

const left = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `${d}d ${h}h left` : h ? `${h}h ${m % 60}m left` : `${m}m left`; };

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

function RaceSheet({ id, onClose, onChange }) {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(() => syncSessions().then(() => api(`competitions?op=get&id=${id}`)).then(setD).catch((x) => setErr(x.message)), [id]);
  useEffect(() => { setD(null); setErr(''); if (id) load(); }, [id, load]);
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
  return (
    <Sheet open={!!id} onClose={onClose} title={c?.name || 'Race'}>
      {err && <p className="py-6 text-center text-sm text-rose-300">{err}</p>}
      {!err && !d && <p className="py-6 text-center text-sm text-white/40">Loading…</p>}
      {c && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/55">{c.ended ? 'Finished' : left(new Date(c.endsAt) - Date.now())}</span>
            <span className="flex items-center gap-1.5 text-amber-200"><Coin size={14} /> Winner gets {c.reward}</span>
          </div>
          {!c.ended && (
            <button onClick={copy} className="press flex w-full items-center justify-between rounded-2xl bg-white/[.07] px-4 py-3 text-left">
              <span><span className="block text-[11px] uppercase tracking-[.2em] text-white/40">Invite code</span><span className="tnum text-2xl font-semibold tracking-[.25em]">{c.code}</span></span>
              <Copy size={18} className="text-white/50" />
            </button>
          )}
          <RaceBars rows={d.standings} />
          <ol className="space-y-1.5">
            {d.standings.map((r, i) => (
              <li key={i} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${r.me ? 'bg-emerald-400/15 ring-1 ring-emerald-300/30' : 'bg-white/[.04]'}`}>
                <span className={`tnum w-6 text-center text-sm font-semibold ${r.rank === 1 ? 'text-amber-300' : 'text-white/40'}`}>{r.rank}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}{r.me && <span className="text-emerald-300"> · you</span>}</span>
                {c.ended && r.leader && <Crown size={15} className="text-amber-300" />}
                <span className="tnum text-sm">{dur(r.minutes)}</span>
              </li>
            ))}
          </ol>
          {c.ended && c.won && !c.claimed && <button disabled={busy} onClick={claim} className="cta h-12 w-full rounded-full font-semibold disabled:opacity-50">Claim {c.reward} coins</button>}
          {c.ended && c.won && c.claimed && <p className="text-center text-sm text-emerald-300">Reward claimed. Well played!</p>}
          {c.ended && !c.won && <p className="text-center text-sm text-white/45">{c.leader ? `${c.leader} won this one.` : 'Nobody focused this time.'}</p>}
          {!c.ended && <p className="text-center text-xs text-white/35">Every finished session counts. The most focus time when the timer ends wins.</p>}
        </div>
      )}
    </Sheet>
  );
}

function Races() {
  const [list, setList] = useState(null), [err, setErr] = useState(''), [open, setOpen] = useState(null);
  const [form, setForm] = useState(false), [name, setName] = useState(''), [days, setDays] = useState(7), [code, setCode] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(() => syncSessions().then(() => api('competitions?op=list')).then((r) => { setList(r.competitions); setErr(''); }).catch((x) => setErr(x.message)), []);
  useEffect(() => { load(); }, [load]);
  const go = async (fn) => { setBusy(true); try { const r = await fn(); await load(); if (r?.competition) { setOpen(r.competition.id); setForm(false); setName(''); setCode(''); } } catch (x) { toast(x.message); } setBusy(false); };
  const create = (e) => { e.preventDefault(); go(() => api('competitions?op=create', { method: 'POST', body: { name, days } })); };
  const join = (e) => { e.preventDefault(); go(() => api('competitions?op=join', { method: 'POST', body: { code } })); };
  const winning = list?.filter((c) => c.won && !c.claimed).length || 0;
  return (
    <div className="mt-4 space-y-3">
      {winning > 0 && <div className="glass anim-rise rounded-3xl bg-amber-300/10 p-4 text-sm text-amber-100">You have {winning} prize{winning > 1 ? 's' : ''} waiting. Open the race to claim it.</div>}
      <form onSubmit={join} className="flex gap-2">
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
      {err && <p className="py-4 text-center text-sm text-rose-300">{err}</p>}
      {!err && !list && <p className="py-4 text-center text-sm text-white/40">Loading…</p>}
      {list?.length === 0 && <p className="py-4 text-center text-sm text-white/45">No races yet. Start one and share the code with friends.</p>}
      {list?.map((c) => <RaceCard key={c.id} c={c} onOpen={() => setOpen(c.id)} />)}
      <RaceSheet id={open} onClose={() => setOpen(null)} onChange={load} />
    </div>
  );
}

export default function Ranks() {
  const acc = useAccount(), [view, setView] = useState('board');
  return (
    <div className="no-scrollbar h-full overflow-y-auto px-5 pb-32 pt-[calc(env(safe-area-inset-top)+14px)]">
      <div className="flex items-center justify-between">
        <h1 className="anim-rise text-[34px] font-semibold leading-none tracking-tighter">Ranks</h1>
        {acc.status === 'in' && <button onClick={() => { signOutSynced(); toast('Signed out'); }} aria-label="Sign out" className="press flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs text-white/60"><LogOut size={14} />{acc.user?.name || 'Sign out'}</button>}
      </div>
      {acc.status === 'off' && <p className="mt-6 text-sm text-white/55">The leaderboard is not set up on this build yet.</p>}
      {acc.status === 'loading' && <p className="py-10 text-center text-sm text-white/40">Loading…</p>}
      {acc.status === 'out' && <SignInForm />}
      {acc.status === 'in' && (
        <>
          <div className="mt-5 grid grid-cols-2 rounded-full bg-white/[.06] p-1 text-sm">
            {[['board', 'Leaderboard', Trophy], ['races', 'Races', Swords]].map(([k, l, Icon]) => (
              <button key={k} onClick={() => setView(k)} className={`flex h-10 items-center justify-center gap-2 rounded-full font-medium transition-colors ${view === k ? 'bg-white/15 text-white' : 'text-white/45'}`}><Icon size={15} />{l}</button>
            ))}
          </div>
          {view === 'board' ? <Leaderboard /> : <Races />}
        </>
      )}
    </div>
  );
}
