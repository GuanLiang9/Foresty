export const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const mmss = (sec, up = false) => {
  sec = Math.max(0, up ? Math.floor(sec) : Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const dur = (min) => {
  min = Math.round(min);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

export const mulberry = (a) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Longer sessions grow visibly larger plants.
export const tier = (min) => (min < 25 ? 0.78 : min < 50 ? 0.9 : min < 90 ? 1 : 1.1);

export async function notify(title, body) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    const opt = { body, icon: './icon-192.png', badge: './icon-192.png', tag: 'evergrove' };
    if (reg) reg.showNotification(title, opt);
    else new Notification(title, opt);
  } catch {}
}
