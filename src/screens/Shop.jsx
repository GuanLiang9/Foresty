import { useState } from 'react';
import { Lock, Check, ShieldCheck } from 'lucide-react';
import Plant from '../components/Plant';
import { Coin, toast } from '../components/ui';
import { useGrowIn } from '../lib/hooks';
import { SPECIES, SP, RARITY, SHIELD_PRICE, MAX_SHIELDS } from '../data';
import { useStore, buy, select, buyShield, haptic, sfx } from '../store';

export default function Shop() {
  const s = useStore();
  const [view, setView] = useState(s.selected);
  const sp = SP[view], owned = s.owned.includes(view), using = s.selected === view, short = sp.price - s.coins;
  const g = useGrowIn(view, 1200);

  const act = () => {
    if (using) return;
    if (owned) { select(view); haptic(8); return; }
    const unlocked = buy(view);
    if (!unlocked) { toast(`${short} more coins to go`); haptic(40); return; }
    sfx('done'); haptic([20, 40, 60]);
    toast(`${sp.name} unlocked`);
    unlocked.forEach((a) => toast(`${a.name} · +${a.reward} coins`));
  };
  const shield = () => {
    if (s.freezes >= MAX_SHIELDS) return toast('Shields are full');
    if (!buyShield()) return toast(`${SHIELD_PRICE - s.coins} more coins to go`);
    sfx('coin'); haptic(15); toast('Streak shield ready');
  };

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-5 pb-32 pt-[calc(env(safe-area-inset-top)+14px)]">
      <div className="anim-rise flex items-start justify-between">
        <h1 className="text-[34px] font-semibold leading-none tracking-tighter">Nursery</h1>
        <div className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold"><Coin /><span className="tnum">{s.coins}</span></div>
      </div>

      <div className="glass anim-rise relative mt-5 overflow-hidden rounded-[32px] p-5" style={{ animationDelay: '.05s' }}>
        <div className="absolute inset-x-0 top-0 h-56 transition-colors duration-700" style={{ background: `radial-gradient(70% 90% at 50% 35%, ${sp.pal.b}40, transparent)` }} />
        <div className="relative mx-auto h-52 w-44">
          <div className="absolute bottom-[3%] left-1/2 h-4 w-28 -translate-x-1/2 rounded-[50%] bg-black/50 blur-md" />
          <Plant key={view} species={view} g={g} className="relative h-full w-full" />
        </div>
        <div className="relative mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className={`text-[11px] font-semibold uppercase tracking-[.25em] ${RARITY[sp.rarity]}`}>{sp.rarity}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{sp.name}</div>
            <div className="mt-1 text-sm leading-snug text-white/50">{sp.blurb}</div>
          </div>
        </div>
        <button onClick={act} className={`relative mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold ${using ? 'bg-white/5 text-white/40' : owned || short <= 0 ? 'cta' : 'press border border-white/10 bg-white/5 text-white/60'}`}>
          {using ? <><Check size={18} /> Planting this</> : owned ? 'Plant this' : <>{short > 0 && <Lock size={15} />} Unlock · <Coin /> {sp.price}</>}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {SPECIES.map((x, i) => {
          const have = s.owned.includes(x.id);
          return (
            <button key={x.id} onClick={() => { setView(x.id); haptic(5); }} className={`anim-rise press relative flex flex-col items-center rounded-2xl border p-1.5 pb-2 ${view === x.id ? 'border-emerald-300/60 bg-emerald-300/10' : 'border-white/[.07] bg-white/[.03]'}`} style={{ animationDelay: `${0.1 + i * 0.025}s` }}>
              <Plant species={x.id} sway={false} lite className={`h-16 w-full transition ${have ? '' : 'opacity-45 saturate-50'}`} />
              <span className="tnum mt-0.5 flex h-4 items-center gap-1 text-[10px] font-medium text-white/50">
                {s.selected === x.id ? <Check size={11} className="text-emerald-300" /> : have ? 'Owned' : <><Coin size={10} />{x.price}</>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-7 text-[11px] font-semibold uppercase tracking-[.25em] text-white/40">Protection</div>
      <div className="glass mt-2 flex items-center gap-4 rounded-3xl p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300"><ShieldCheck size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Streak shield <span className="tnum ml-1 text-xs font-medium text-white/40">{s.freezes}/{MAX_SHIELDS}</span></div>
          <div className="text-xs leading-snug text-white/45">Covers one missed day automatically.</div>
        </div>
        <button onClick={shield} className="press flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-sm font-semibold"><Coin />{SHIELD_PRICE}</button>
      </div>
    </div>
  );
}
