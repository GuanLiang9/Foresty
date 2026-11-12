import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm anim-fade" onClick={onClose} />
      <div className="sheet anim-sheet relative w-full max-w-md max-h-[86dvh] overflow-y-auto no-scrollbar rounded-t-[28px] px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        {title && <h3 className="mb-4 text-xl font-semibold tracking-tight">{title}</h3>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const Coin = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" className="shrink-0">
    <circle cx="10" cy="10" r="9" fill="#fbbf24" />
    <circle cx="10" cy="10" r="6.2" fill="none" stroke="#fde68a" strokeWidth="1.4" />
    <path d="M10 13.6C10 10 7.6 8.4 6 8.6C6.4 11.4 8 13.2 10 13.6ZM10 13.6C10 9.4 12.4 7 14.2 6.8C14.4 10 12.6 13 10 13.6Z" fill="#92400e" />
  </svg>
);

export const Toggle = ({ on, onChange }) => (
  <button onClick={() => onChange(!on)} role="switch" aria-checked={on} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${on ? 'bg-emerald-400' : 'bg-white/15'}`}>
    <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-300 ${on ? 'translate-x-5' : ''}`} style={{ transitionTimingFunction: 'cubic-bezier(.3,1.5,.5,1)' }} />
  </button>
);

export const Stepper = ({ value, onChange, min, max, step, unit }) => (
  <div className="flex items-center gap-1">
    <button className="press h-8 w-8 rounded-full bg-white/10 text-lg leading-none" onClick={() => onChange(Math.max(min, value - step))}>−</button>
    <span className="tnum w-16 text-center text-sm">{value} {unit}</span>
    <button className="press h-8 w-8 rounded-full bg-white/10 text-lg leading-none" onClick={() => onChange(Math.min(max, value + step))}>+</button>
  </div>
);

let push;
export const toast = (m) => push?.(m);

export function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    push = (m) => {
      const id = Math.random();
      setList((l) => [...l.slice(-2), { id, m }]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 2600);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+14px)] z-[70] flex flex-col items-center gap-2 px-6">
      {list.map((t) => <div key={t.id} className="glass anim-rise rounded-full px-4 py-2 text-center text-sm">{t.m}</div>)}
    </div>
  );
}
