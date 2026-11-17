import { useEffect, useState } from 'react';
import { Trophy, LogOut } from 'lucide-react';
import { Sheet, toast } from './ui';
import { useAccount, signIn, signUp, signOut } from '../lib/auth';
import { syncSessions } from '../lib/sync';
import { api } from '../lib/api';
import { dur } from '../lib/util';

const input = 'h-12 w-full rounded-2xl bg-white/[.07] px-4 text-[15px] outline-none ring-emerald-300/50 placeholder:text-white/30 focus:ring-2';

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
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm leading-relaxed text-white/55">Sign in to see how your focus time compares. Your grove stays on this device; only finished sessions from the past week are shared.</p>
      {mode === 'up' && <input className={input} placeholder="Display name" maxLength={24} required value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />}
      <input className={input} type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input className={input} type="password" placeholder="Password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
      {err && <p className="text-sm text-rose-300">{err}</p>}
      <button disabled={busy} className="cta h-12 w-full rounded-full font-semibold disabled:opacity-50">{busy ? 'One moment…' : mode === 'up' ? 'Create account' : 'Sign in'}</button>
      <button type="button" onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setErr(''); }} className="w-full py-2 text-sm text-white/55">
        {mode === 'up' ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>
    </form>
  );
}

function Board({ user }) {
  const [period, setPeriod] = useState('week'), [data, setData] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setErr('');
    syncSessions().then(() => api(`leaderboard?period=${period}`))
      .then((d) => live && setData(d))
      .catch((x) => live && setErr(x.message));
    return () => { live = false; };
  }, [period]);
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 rounded-full bg-white/[.06] p-1 text-sm">
        {[['week', 'This week'], ['month', '30 days']].map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)} className={`h-9 rounded-full font-medium transition-colors ${period === k ? 'bg-white/15 text-white' : 'text-white/45'}`}>{l}</button>
        ))}
      </div>
      {err && <p className="py-6 text-center text-sm text-rose-300">{err}</p>}
      {!err && !data && <p className="py-6 text-center text-sm text-white/40">Loading…</p>}
      {data && !data.top.length && <p className="py-6 text-center text-sm text-white/45">No one has finished a session yet. Grow a tree to take first place.</p>}
      {data && data.top.length > 0 && (
        <ol className="space-y-1.5">
          {data.top.map((r, i) => (
            <li key={i} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${r.me ? 'bg-emerald-400/15 ring-1 ring-emerald-300/30' : 'bg-white/[.04]'}`}>
              <span className={`tnum w-6 text-center text-sm font-semibold ${r.rank <= 3 ? 'text-amber-300' : 'text-white/40'}`}>{r.rank}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}{r.me && <span className="text-emerald-300"> · you</span>}</span>
              <span className="tnum text-right text-sm">{dur(r.minutes)}<span className="block text-[11px] text-white/40">{r.plants} plant{r.plants === 1 ? '' : 's'}</span></span>
            </li>
          ))}
        </ol>
      )}
      {data?.me && !data.top.some((r) => r.me) && <p className="tnum mt-3 text-center text-sm text-white/55">You are #{data.me.rank} with {dur(data.me.minutes)}</p>}
      <div className="mt-5 flex items-center justify-between border-t border-white/[.06] pt-4 text-sm text-white/45">
        <span className="truncate">Signed in as {user.name || user.email}</span>
        <button onClick={() => { signOut(); toast('Signed out'); }} className="press flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/70"><LogOut size={14} />Sign out</button>
      </div>
    </div>
  );
}

export function LeaderboardSheet({ open, onClose }) {
  const acc = useAccount();
  return (
    <Sheet open={open} onClose={onClose} title="Leaderboard">
      {acc.status === 'off' && <p className="text-sm text-white/55">The leaderboard is not set up on this build yet.</p>}
      {acc.status === 'loading' && <p className="py-6 text-center text-sm text-white/40">Loading…</p>}
      {acc.status === 'out' && <SignInForm />}
      {acc.status === 'in' && <Board user={acc.user} />}
    </Sheet>
  );
}

export function LeaderboardCard({ onOpen }) {
  const acc = useAccount();
  if (acc.status === 'off') return null;
  return (
    <button onClick={onOpen} className="glass anim-rise press mt-3 flex w-full items-center gap-3 rounded-3xl p-4 text-left">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/15 text-amber-300"><Trophy size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Leaderboard</span>
        <span className="block text-xs text-white/45">{acc.status === 'in' ? 'See this week’s top growers' : 'Sign in to compare focus time with others'}</span>
      </span>
      <span className="text-white/30">›</span>
    </button>
  );
}
