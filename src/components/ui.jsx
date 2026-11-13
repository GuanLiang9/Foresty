import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Bottom sheet. Closes by: swipe down, backdrop tap, Escape, or the Android back button.
export function Sheet({ open, onClose, title, children }) {
  const [render, setRender] = useState(open), [leaving, setLeaving] = useState(false);
  const el = useRef(), close = useRef(onClose);
  close.current = onClose;

  // Keep the sheet mounted briefly after `open` drops so it can slide out.
  useEffect(() => {
    if (open) { setRender(true); setLeaving(false); return; }
    if (!render) return;
    setLeaving(true);
    const t = setTimeout(() => { setRender(false); setLeaving(false); }, 280);
    return () => clearTimeout(t);
  }, [open]);

  // An open sheet owns one history entry, so "back" closes it instead of leaving the app.
  useEffect(() => {
    if (!open) return;
    let popped = false;
    history.pushState({ sheet: true }, '');
    const pop = () => { popped = true; close.current(); };
    const key = (e) => e.key === 'Escape' && close.current();
    addEventListener('popstate', pop);
    addEventListener('keydown', key);
    return () => { removeEventListener('popstate', pop); removeEventListener('keydown', key); if (!popped && history.state?.sheet) history.back(); };
  }, [open]);

  // Swipe down to dismiss. Only starts when the content is scrolled to the top, and never from a slider.
  useEffect(() => {
    const node = el.current;
    if (!node || !open) return;
    let d = null;
    const start = (e) => { d = e.target.closest('input[type=range]') || node.scrollTop > 0 ? null : { y: e.touches[0].clientY, t: Date.now(), dy: 0, on: false }; };
    const move = (e) => {
      if (!d) return;
      const dy = e.touches[0].clientY - d.y;
      if (!d.on) {
        if (dy < -6) { d = null; return; }
        if (dy < 6) return;
        d.on = true;
        node.style.transition = 'none';
      }
      d.dy = Math.max(0, dy);
      node.style.transform = `translateY(${d.dy}px)`;
      e.preventDefault();
    };
    const end = () => {
      if (!d?.on) { d = null; return; }
      const fast = d.dy / Math.max(1, Date.now() - d.t) > 0.6;
      node.style.transition = '';
      if (d.dy > 110 || (fast && d.dy > 30)) close.current();
      else node.style.transform = '';
      d = null;
    };
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    node.addEventListener('touchcancel', end);
    return () => { node.removeEventListener('touchstart', start); node.removeEventListener('touchmove', move); node.removeEventListener('touchend', end); node.removeEventListener('touchcancel', end); };
  }, [open, render]);

  if (!open && !render) return null;
  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-end justify-center ${leaving ? 'pointer-events-none' : ''}`}>
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 anim-fade ${leaving ? 'opacity-0' : ''}`} onClick={onClose} />
      <div ref={el} role="dialog" aria-modal="true" aria-label={title} className="sheet anim-sheet relative w-full max-w-md max-h-[calc(var(--app-h)*.86)] overflow-y-auto overscroll-contain no-scrollbar rounded-t-[28px] px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] transition-transform duration-300" style={leaving ? { transform: 'translateY(100%)' } : undefined}>
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-white/25" />
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
