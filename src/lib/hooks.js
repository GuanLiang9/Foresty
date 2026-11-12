import { useEffect, useRef, useState } from 'react';

// Eases toward a moving target so growth never jumps between timer ticks.
export function useSmooth(target) {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    let raf;
    const step = () => {
      const d = target - cur.current;
      if (Math.abs(d) < 0.002) { cur.current = target; setV(target); return; }
      cur.current += d * 0.1;
      setV(cur.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

// Replays a 0 → 1 growth whenever `key` changes.
export function useGrowIn(key, ms = 1100) {
  const [g, setG] = useState(0);
  useEffect(() => {
    let raf, t0;
    const step = (t) => {
      t0 ??= t;
      const p = Math.min(1, (t - t0) / ms);
      setG(p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setG(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, ms]);
  return g;
}

export function useCount(target, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, t0;
    const step = (t) => {
      t0 ??= t;
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
