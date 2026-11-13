import { Zap as Bolt, Flame, ShieldCheck, Check, Sprout, Trees, TreePine, Mountain, Clock, Zap, Crown, Infinity as Loop, Hourglass, Flower2, Sunrise, Moon, Sparkles, Shapes, Gem } from 'lucide-react';
import { Coin, toast } from '../components/ui';
import Plant from '../components/Plant';
import { ACHIEVEMENTS, SP } from '../data';
import { dayKey, dur } from '../lib/util';
import { useStore, streakOf, bestStreak, okDays, xpOf, levelInfo, questsOf, claimQuest, challengesOf, claimChallenge, todayMinutes, lifetime, haptic, sfx } from '../store';

const ICON = { first: Sprout, t10: Trees, t50: TreePine, t200: Mountain, h5: Clock, h25: Zap, h100: Crown, s3: Flame, s7: Flame, s30: Loop, long: Hourglass, day5: Flower2, early: Sunrise, night: Moon, gold: Sparkles, col5: Shapes, colall: Gem };

export default function Journey() {
  const s = useStore();
  const lv = levelInfo(xpOf(s)), streak = streakOf(s), best = bestStreak(s), days = okDays(s), L = lifetime(s);
  const today = todayMinutes(s), goal = s.settings.goal, pct = Math.min(1, today / goal), C = 2 * Math.PI * 34;
  const quests = questsOf(s), got = Object.keys(s.ach).length;
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dayKey(d); return { k, l: 'SMTWTFS'[d.getDay()], ok: days.has(k), frozen: !!s.frozen[k], today: i === 6 }; });
  const claim = (q) => { const r = claimQuest(q.id); if (r) { sfx('coin'); haptic(15); toast(`+${r.reward} coins`); if (r.boost) toast('All quests done · 2× coin boost earned'); } };
  const { monthly, event } = challengesOf(s);
  const day = (t) => new Date(t).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
  const take = (c) => { const r = claimChallenge(c.key); if (!r) return; sfx('done'); haptic([20, 40, 60]); toast(r.coins ? `Already owned · +${r.coins} coins` : `${SP[c.reward].name} unlocked`); };
  const card = (c, label, note, open) => (
    <div className="glass relative overflow-hidden rounded-3xl p-3 pr-4">
      <div className="absolute inset-y-0 left-0 bg-rose-400/10 transition-all duration-700" style={{ width: `${open ? (c.v / c.goal) * 100 : 0}%` }} />
      <div className="relative flex items-center gap-3">
        <Plant species={c.reward} sway={false} lite className={`h-16 w-14 shrink-0 ${open ? '' : 'opacity-40 saturate-50'}`} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-rose-300">{label}</div>
          <div className="mt-0.5 text-sm font-medium">{c.text}</div>
          <div className="tnum mt-0.5 text-xs text-white/40">{open ? `${c.shown} · ` : ''}{note}</div>
        </div>
        {c.claimed ? <Check size={18} className="text-emerald-300" /> : open && c.v >= c.goal ? <button onClick={() => take(c)} className="cta h-9 rounded-full px-4 text-sm font-semibold">Claim</button> : <span className="max-w-[4.5rem] text-right text-[11px] leading-tight text-white/45">{SP[c.reward].name}</span>}
      </div>
    </div>
  );

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-5 pb-32 pt-[calc(env(safe-area-inset-top)+14px)]">
      <h1 className="anim-rise text-[34px] font-semibold leading-none tracking-tighter">Journey</h1>

      <div className="glass anim-rise relative mt-5 overflow-hidden rounded-[32px] p-5" style={{ animationDelay: '.05s' }}>
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex items-end justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[.25em] text-emerald-300">Level {lv.level}</div>
            <div className="mt-1 text-4xl font-semibold tracking-tighter">{lv.title}</div>
          </div>
          <div className="tnum text-right text-xs text-white/45">{dur(lv.span - lv.into)}<br />to level {lv.level + 1}</div>
        </div>
        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(lv.into / lv.span) * 100}%`, background: 'linear-gradient(90deg,#34d399,#22d3ee)' }} />
        </div>
        <div className="relative mt-4 flex gap-6 text-sm">
          <div><b className="tnum">{L.trees}</b> <span className="text-white/45">plants</span></div>
          <div><b className="tnum">{dur(L.minutes)}</b> <span className="text-white/45">focused</span></div>
          <div><b className="tnum">{L.golden}</b> <span className="text-white/45">golden</span></div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-3">
        <div className="glass anim-rise col-span-3 rounded-3xl p-4" style={{ animationDelay: '.1s' }}>
          <div className="flex items-center gap-2">
            <Flame size={30} className={streak ? 'text-orange-400' : 'text-white/25'} fill={streak ? 'currentColor' : 'none'} />
            <span className="tnum text-4xl font-semibold tracking-tighter">{streak}</span>
            <span className="text-xs leading-tight text-white/45">day<br />streak</span>
          </div>
          <div className="mt-3 flex justify-between">
            {week.map((d) => (
              <div key={d.k} className="flex flex-col items-center gap-1">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${d.ok ? 'bg-orange-400 text-black' : d.frozen ? 'bg-cyan-400/25 text-cyan-200' : d.today ? 'border border-dashed border-white/30' : 'bg-white/[.06]'}`}>{d.ok ? <Check size={12} strokeWidth={3} /> : d.frozen ? <ShieldCheck size={12} /> : ''}</span>
                <span className={`text-[9px] ${d.today ? 'text-white' : 'text-white/35'}`}>{d.l}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[11px] text-white/40"><span>Best {best}</span><span className="flex items-center gap-1"><ShieldCheck size={11} /> {s.freezes} shield{s.freezes === 1 ? '' : 's'}</span></div>
        </div>
        <div className="glass anim-rise col-span-2 flex flex-col items-center justify-center rounded-3xl p-4" style={{ animationDelay: '.15s' }}>
          <div className="relative h-24 w-24">
            <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={pct >= 1 ? '#fbbf24' : '#34d399'} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="tnum text-lg font-semibold leading-none">{dur(today)}</span><span className="mt-0.5 text-[10px] text-white/40">of {dur(goal)}</span></div>
          </div>
          <div className="mt-2 text-[11px] text-white/45">{pct >= 1 ? 'Goal reached' : 'Daily goal'}</div>
        </div>
      </div>

      {s.boosts > 0 && (
        <div className="glass anim-rise mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"><Bolt size={18} className="text-amber-300" fill="currentColor" /><span className="flex-1"><b>2× coin boost</b> ready for your next {s.boosts > 1 ? `${s.boosts} sessions` : 'session'}</span></div>
      )}

      <div className="mt-7 text-[11px] font-semibold uppercase tracking-[.25em] text-white/40">Challenges</div>
      <div className="mt-2 space-y-2">
        {card(monthly, monthly.name, `ends ${day(monthly.b - 1)}`, true)}
        {card(event, event.name, event.active ? `ends ${day(event.b - 1)}` : `starts ${day(event.a)}`, event.active)}
      </div>

      <div className="mt-7 flex items-baseline justify-between"><span className="text-[11px] font-semibold uppercase tracking-[.25em] text-white/40">Today’s quests</span><span className="text-[11px] text-white/30">New at midnight</span></div>
      <div className="mt-2 space-y-2">
        {quests.map((q, i) => (
          <div key={q.id} className="glass anim-rise relative overflow-hidden rounded-2xl px-4 py-3.5" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>
            <div className="absolute inset-y-0 left-0 bg-emerald-400/10 transition-all duration-700" style={{ width: `${(q.v / q.goal) * 100}%` }} />
            <div className="relative flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${q.claimed ? 'text-white/40 line-through' : ''}`}>{q.text}</div>
                <div className="tnum mt-0.5 text-xs text-white/40">{q.v} / {q.goal}</div>
              </div>
              {q.claimed ? <Check size={18} className="text-emerald-300" /> : q.done
                ? <button onClick={() => claim(q)} className="cta flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">Claim <Coin size={14} />{q.reward}</button>
                : <span className="tnum flex items-center gap-1 text-sm text-white/45"><Coin size={14} />{q.reward}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-7 flex items-baseline justify-between"><span className="text-[11px] font-semibold uppercase tracking-[.25em] text-white/40">Milestones</span><span className="tnum text-[11px] text-white/30">{got} / {ACHIEVEMENTS.length}</span></div>
      <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-5">
        {ACHIEVEMENTS.map((a) => {
          const Icon = ICON[a.id], on = !!s.ach[a.id];
          return (
            <div key={a.id} className="flex flex-col items-center text-center">
              <div className={`flex h-14 w-14 items-center justify-center rounded-full border ${on ? 'border-amber-200/50 text-amber-200 shadow-[0_0_24px_-4px_rgba(251,191,36,.6)]' : 'border-white/10 text-white/20'}`} style={on ? { background: 'radial-gradient(circle at 30% 25%, rgba(253,230,138,.35), rgba(245,158,11,.1))' } : undefined}><Icon size={22} /></div>
              <div className={`mt-2 text-xs font-medium ${on ? '' : 'text-white/45'}`}>{a.name}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-white/30">{a.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
