// Procedural ambience + chimes. Everything is synthesised, so the app ships no audio files.
let ctx, master, white, brown, stopT;
const tracks = {};

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const len = ctx.sampleRate * 4;
  white = ctx.createBuffer(1, len, ctx.sampleRate);
  brown = ctx.createBuffer(1, len, ctx.sampleRate);
  const w = white.getChannelData(0), b = brown.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    last = (last + 0.02 * x) / 1.02;
    b[i] = last * 3.5;
  }
  return ctx;
}

const src = (buf) => { const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true; n.start(); return n; };
const bq = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
const gn = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
const lfo = (f, depth, target) => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(gn(depth)).connect(target); o.start(); return o; };
const chain = (...n) => n.reduce((a, b) => (a.connect(b), b));

const BUILD = {
  rain(out) {
    const a = src(white), b = src(brown);
    chain(a, bq('highpass', 1200), bq('lowpass', 7000), gn(0.16), out);
    chain(b, bq('lowpass', 500), gn(0.5), out);
    return { nodes: [a, b] };
  },
  wind(out) {
    const a = src(brown), f = bq('bandpass', 380, 0.5), g = gn(1.4);
    chain(a, f, g, out);
    return { nodes: [a, lfo(0.07, 220, f.frequency), lfo(0.13, 0.6, g.gain)] };
  },
  waves(out) {
    const a = src(white), f = bq('lowpass', 650), g = gn(0.22);
    chain(a, f, g, out);
    return { nodes: [a, lfo(0.09, 0.2, g.gain), lfo(0.09, 300, f.frequency)] };
  },
  fire(out) {
    const a = src(brown), g = gn(0.9), c = src(white), cg = gn(0);
    chain(a, bq('lowpass', 300), g, out);
    chain(c, bq('bandpass', 3200, 1.5), cg, out);
    const t = setInterval(() => {
      if (Math.random() > 0.55) return;
      const n = ctx.currentTime + Math.random() * 0.12;
      cg.gain.setValueAtTime(0.25 + Math.random() * 0.5, n);
      cg.gain.exponentialRampToValueAtTime(0.001, n + 0.03 + Math.random() * 0.05);
    }, 130);
    return { nodes: [a, c, lfo(0.4, 0.25, g.gain)], timers: [t] };
  },
  night(out) {
    const o = ctx.createOscillator(), trem = gn(0.5), gate = gn(0), bed = src(brown);
    o.frequency.value = 4200;
    o.start();
    chain(o, trem, gate, gn(0.07), out);
    chain(bed, bq('lowpass', 220), gn(0.3), out);
    const t = setInterval(() => {
      const n = ctx.currentTime + 0.05;
      for (let k = 0; k < 3; k++) {
        gate.gain.setTargetAtTime(1, n + k * 0.11, 0.008);
        gate.gain.setTargetAtTime(0, n + k * 0.11 + 0.055, 0.012);
      }
    }, 950);
    return { nodes: [o, bed, lfo(55, 0.5, trem.gain)], timers: [t] };
  },
  deep(out) {
    const a = src(brown);
    chain(a, bq('lowpass', 180), gn(1.6), out);
    return { nodes: [a] };
  },
};

export function unlock() {
  if (init()) ctx.resume();
}

export function play(levels = {}) {
  if (!init()) return;
  ctx.resume();
  clearTimeout(stopT);
  for (const id of Object.keys(BUILD)) {
    const v = levels[id] || 0;
    if (v > 0 && !tracks[id]) {
      const out = gn(0);
      out.connect(master);
      tracks[id] = { out, ...BUILD[id](out) };
    }
    if (tracks[id]) tracks[id].out.gain.setTargetAtTime(v * v, ctx.currentTime, 0.15);
  }
  master.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
}

export function stop() {
  if (!ctx) return;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  clearTimeout(stopT);
  // Tear the graph down once it has faded so idle screens cost no CPU.
  stopT = setTimeout(() => {
    for (const id of Object.keys(tracks)) {
      tracks[id].nodes.forEach((n) => { try { n.stop(); } catch {} });
      tracks[id].timers?.forEach(clearInterval);
      tracks[id].out.disconnect();
      delete tracks[id];
    }
  }, 1500);
}

const SEQ = {
  done: [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.4]],
  fail: [[220, 0], [174.6, 0.25]],
  start: [[392, 0], [587.3, 0.1]],
  coin: [[1318.5, 0], [1760, 0.07]],
  tick: [[1800, 0]],
};

export function chime(kind) {
  if (!init()) return;
  ctx.resume();
  const t0 = ctx.currentTime + 0.02, short = kind === 'tick';
  for (const [f, dt] of SEQ[kind]) {
    const o = ctx.createOscillator(), g = gn(0), t = t0 + dt;
    o.type = kind === 'fail' ? 'triangle' : 'sine';
    o.frequency.value = f;
    o.connect(g).connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(short ? 0.03 : 0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (short ? 0.04 : 0.9));
    o.start(t);
    o.stop(t + 1);
  }
}
