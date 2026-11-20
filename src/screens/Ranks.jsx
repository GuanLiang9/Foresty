import { useCallback, useEffect, useState } from 'react';
import { Trophy, Copy, LogOut, Users, Check, X, ChevronRight } from 'lucide-react';
import { toast, input } from '../components/ui';
import { RaceBars } from '../components/Charts';
import Compete from './Compete';
import { useAccount, signIn, signUp } from '../lib/auth';
import FriendGrove from '../components/FriendGrove';
import { signOutSynced, pushIfChanged } from '../lib/sync';
import { recall, remember } from '../lib/cache';
import { api } from '../lib/api';
import { dur } from '../lib/util';

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

function Friends() {
  const [d, setD] = useState(() => recall('friends')), [code, setCode] = useState(() => recall('fcode')), [err, setErr] = useState('');
  const [add, setAdd] = useState(''), [busy, setBusy] = useState(false), [who, setWho] = useState(null), [rm, setRm] = useState(null);
  const load = useCallback(() => pushIfChanged().catch(() => {}).then(() => api('friends?op=list')).then((r) => { setD(remember('friends', r)); setErr(''); })
    .catch((x) => !recall('friends') && setErr(x.message)), []);
  useEffect(() => { load(); api('friends?op=me').then((r) => setCode(remember('fcode', r.code))).catch(() => {}); }, [load]);
  const act = async (fn, msg) => { setBusy(true); try { const r = await fn(); if (msg) toast(msg(r)); await load(); return true; } catch (x) { toast(x.message); } finally { setBusy(false); } };
  const request = async (e) => {
    e.preventDefault();
    const ok = await act(() => api('friends?op=request', { method: 'POST', body: { code: add } }), (r) => (r.status === 'accepted' ? `You and ${r.name} are friends` : `Request sent to ${r.name}`));
    if (ok) setAdd('');
  };
  const accept = (uid) => act(() => api('friends?op=accept', { method: 'POST', body: { uid } }), () => 'Friend added');
  const drop = (uid) => act(() => api('friends?op=remove', { method: 'POST', body: { uid } }));
  const remove = (uid) => { if (rm !== uid) return setRm(uid); setRm(null); drop(uid); };
  const copy = async () => { try { await navigator.clipboard.writeText(code); toast('Code copied'); } catch { toast(`Code: ${code}`); } };
  const rows = d ? [{ name: 'You', minutes: d.me.minutes, me: true }, ...d.friends.slice(0, 5)].sort((p, q) => q.minutes - p.minutes) : [];
  return (
    <div className="mt-4 space-y-3">
      {code && (
        <button onClick={copy} className="glass press flex w-full items-center justify-between rounded-3xl px-4 py-3 text-left">
          <span><span className="block text-[11px] uppercase tracking-[.2em] text-white/40">Your friend code</span><span className="tnum text-2xl font-semibold tracking-[.2em]">{code}</span></span>
          <Copy size={18} className="text-white/50" />
        </button>
      )}
      <form onSubmit={request} className="flex gap-2">
        <input className={`${input} tracking-[.2em] uppercase`} placeholder="Friend code" maxLength={8} value={add} onChange={(e) => setAdd(e.target.value)} />
        <button disabled={busy || add.length < 4} className="press h-12 shrink-0 rounded-full bg-white/10 px-5 text-sm font-semibold disabled:opacity-40">Add</button>
      </form>
      {err && <p className="py-4 text-center text-sm text-rose-300">{err}</p>}
      {!err && !d && <p className="py-4 text-center text-sm text-white/40">Loading…</p>}
      {d?.incoming.map((f) => (
        <div key={f.uid} className="glass anim-rise flex items-center gap-3 rounded-3xl bg-emerald-400/10 p-3 pl-4">
          <span className="min-w-0 flex-1 truncate text-sm"><b>{f.name}</b> <span className="text-white/50">wants to be friends</span></span>
          <button aria-label="Accept" disabled={busy} onClick={() => accept(f.uid)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-black"><Check size={17} /></button>
          <button aria-label="Decline" disabled={busy} onClick={() => drop(f.uid)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><X size={16} /></button>
        </div>
      ))}
      {d && d.friends.length > 0 && (
        <div className="glass anim-rise rounded-3xl p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.2em] text-white/45">This week</div>
          <RaceBars rows={rows} />
        </div>
      )}
      {d?.friends.map((f) => (
        <div key={f.uid} className="glass flex items-center gap-1 rounded-3xl p-1.5 pl-4">
          <button onClick={() => setWho(f)} className="press flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{f.name}<span className="block text-xs font-normal text-white/45">{dur(f.minutes)} this week</span></span>
            <ChevronRight size={16} className="text-white/30" />
          </button>
          <button aria-label="Remove friend" onClick={() => remove(f.uid)} onBlur={() => setRm(null)} className={`press flex h-9 items-center justify-center rounded-full px-3 text-xs ${rm === f.uid ? 'bg-rose-500/30 text-rose-200' : 'text-white/30'}`}>{rm === f.uid ? 'Remove?' : <X size={15} />}</button>
        </div>
      ))}
      {d?.outgoing.map((f) => <div key={f.uid} className="flex items-center justify-between rounded-2xl bg-white/[.04] px-4 py-2.5 text-sm"><span className="truncate">{f.name}</span><span className="text-xs text-white/40">Pending</span></div>)}
      {d && !d.friends.length && !d.incoming.length && !d.outgoing.length && <p className="py-4 text-center text-sm text-white/45">No friends yet. Share your code, or enter theirs, to see each other's focus hours and groves.</p>}
      <FriendGrove who={who} onClose={() => setWho(null)} />
    </div>
  );
}

export default function Ranks() {
  const acc = useAccount(), [view, setView] = useState('compete');
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
            {[['compete', 'Compete', Trophy], ['friends', 'Friends', Users]].map(([k, l, Icon]) => (
              <button key={k} onClick={() => setView(k)} className={`flex h-10 items-center justify-center gap-2 rounded-full font-medium transition-colors ${view === k ? 'bg-white/15 text-white' : 'text-white/45'}`}><Icon size={15} />{l}</button>
            ))}
          </div>
          {view === 'friends' ? <Friends /> : <Compete />}
        </>
      )}
    </div>
  );
}
