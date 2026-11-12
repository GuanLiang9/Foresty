import { useId } from 'react';
import { SP } from '../data';

// Every plant is drawn procedurally from a single growth value g (0 = seed, 1 = mature),
// so the same component animates a live session and renders a finished grove.
const cl = (x) => Math.max(0, Math.min(1, x));
const seg = (g, a, b) => 1 - Math.pow(1 - cl((g - a) / (b - a)), 3);
const Y = 222; // ground line in the 200×240 viewBox

const DEAD = { a: '#b3a48a', b: '#93846c', c: '#746753', t: '#5f5143', x: '#93846c' };
const GOLD = { a: '#fef3c7', b: '#fcd34d', c: '#f59e0b', x: '#fffbeb' };

const Sprout = ({ y, g, fill, o = 1, x = 100 }) => {
  const s = seg(g, 0, 0.16);
  return o > 0 && (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
      <path d="M0 0C-4 -12 -18 -14 -22 -8C-16 0 -6 2 0 0Z" fill={fill} />
      <path d="M0 0C4 -14 20 -16 25 -9C18 0 7 3 0 0Z" fill={fill} opacity=".8" />
    </g>
  );
};

const Trunk = ({ g, h, pal, wMax = 9 }) => {
  const w = 2.5 + wMax * seg(g, 0.1, 1), t = Y - h;
  return <path d={`M${100 - w} ${Y}Q${100 - w * 0.45} ${Y - h * 0.5} ${100 - w * 0.35} ${t}L${100 + w * 0.35} ${t}Q${100 + w * 0.45} ${Y - h * 0.5} ${100 + w} ${Y}Z`} fill={pal.t} />;
};

const BLOBS = [[0, -4, 42, 'c'], [-32, 10, 27, 'c'], [32, 12, 27, 'c'], [-18, -22, 30, 'b'], [20, -20, 31, 'b'], [2, 2, 30, 'b'], [-8, -34, 22, 'a'], [16, -10, 15, 'a'], [-24, -4, 12, 'a']];
const DOTS = [[-20, -22], [10, -32], [28, -8], [-6, -4], [-36, 6], [36, 14], [4, -18], [-14, 12], [18, 8], [-30, -12]];

function Round({ g, pal, dead, dots }) {
  const h = 14 + 92 * seg(g, 0.03, 0.75), top = Y - h, k = dead ? 0.62 : 1;
  const l = 20 * seg(g, 0.42, 0.8), r = 18 * seg(g, 0.5, 0.85), d = seg(g, 0.75, 1);
  return (
    <>
      <Trunk g={g} h={h} pal={pal} />
      {g > 0.42 && <path d={`M100 ${top + h * 0.42}q-10 -4 -${l} -${l * 1.1}M100 ${top + h * 0.34}q10 -4 ${r} -${r * 1.1}`} stroke={pal.t} strokeWidth={2 + 3 * g} fill="none" strokeLinecap="round" />}
      <Sprout y={top + 2} g={g} fill={pal.a} o={1 - seg(g, 0.28, 0.48)} />
      <g transform={`translate(100 ${top - 14 * seg(g, 0.3, 1)})`}>
        <g className="leaf-breathe">
          {BLOBS.map(([x, y, rad, c], i) => {
            const s = seg(g, 0.2 + i * 0.045, 0.62 + i * 0.04) * k;
            return s > 0 && <circle key={i} cx={x * s} cy={y * s} r={rad * s} fill={pal[c]} />;
          })}
          {dots && !dead && d > 0 && DOTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.4 * d} fill={pal.x} />)}
        </g>
      </g>
    </>
  );
}

function Pine({ g, pal, dead, snow }) {
  const h = 16 + 34 * seg(g, 0.03, 0.6), w = 2.5 + 4.5 * seg(g, 0.1, 1), k = dead ? 0.7 : 1;
  const tiers = [[50, 50, 'c'], [42, 46, 'b'], [33, 42, 'b'], [23, 38, 'a']], out = [];
  let y = Y - h + 8;
  tiers.forEach(([hw, th, c], i) => {
    const s = seg(g, 0.16 + i * 0.16, 0.5 + i * 0.16) * k;
    if (s <= 0) return;
    out.push(<path key={i} d={`M${100 - hw * s} ${y}L100 ${y - th * s}L${100 + hw * s} ${y}Z`} fill={pal[c]} stroke={pal[c]} strokeWidth={7 * s} strokeLinejoin="round" />);
    if (snow && !dead) {
      const sy = y - th * s * 0.56, sx = hw * s * 0.42;
      out.push(<path key={`s${i}`} d={`M${100 - sx} ${sy}L100 ${y - th * s}L${100 + sx} ${sy}Q100 ${sy + th * s * 0.14} ${100 - sx} ${sy}Z`} fill={pal.x} stroke={pal.x} strokeWidth={3 * s} strokeLinejoin="round" opacity=".92" />);
    }
    y -= th * s * 0.58;
  });
  return (
    <>
      <rect x={100 - w} y={Y - h} width={w * 2} height={h} rx={w * 0.4} fill={pal.t} />
      <Sprout y={Y - h + 2} g={g} fill={pal.a} o={1 - seg(g, 0.18, 0.36)} />
      <g className="leaf-breathe">{out}</g>
    </>
  );
}

function Flower({ g, pal, dead }) {
  const h = 14 + 110 * seg(g, 0.03, 0.8), top = Y - h, s = seg(g, 0.5, 1) * (dead ? 0.7 : 1), l = seg(g, 0.2, 0.6);
  return (
    <>
      <path d={`M100 ${Y}Q${100 - 12 * g} ${Y - h * 0.5} 100 ${top}`} stroke={pal.t} strokeWidth={3 + 2.5 * g} fill="none" strokeLinecap="round" />
      <path d="M0 0C-6 -14 -26 -16 -32 -8C-22 2 -8 4 0 0Z" fill={pal.c} transform={`translate(${100 - 5 * g} ${Y - h * 0.36}) scale(${l})`} />
      <path d="M0 0C6 -14 26 -16 32 -8C22 2 8 4 0 0Z" fill={pal.c} transform={`translate(${100 - 5 * g} ${Y - h * 0.56}) scale(${l * 0.85})`} />
      <Sprout y={top + 2} g={g} fill={pal.c} o={1 - seg(g, 0.4, 0.6)} />
      <g transform={`translate(100 ${top}) scale(${s}) rotate(${(1 - s) * -120})`}>
        <g className="leaf-breathe">
          {[...Array(14)].map((_, i) => <ellipse key={i} cy="-25" rx="8.5" ry="17" fill={i % 2 ? pal.a : pal.b} transform={`rotate(${(i * 360) / 14})`} />)}
          <circle r="15" fill={pal.x} />
          <circle r="9" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="8" strokeDasharray="1.5 3.5" />
        </g>
      </g>
    </>
  );
}

function Cactus({ g, pal }) {
  const h = 18 + 104 * seg(g, 0.03, 0.8), w = 9 + 11 * seg(g, 0.05, 0.8), top = Y - h, f = seg(g, 0.85, 1);
  const arm = (dir, y, s, up) => s > 0 && (
    <path d={`M${100 + dir * (w - 3)} ${y}h${dir * 20 * s}q${dir * 8 * s} 0 ${dir * 8 * s} -${8 * s}v-${up * s}`} stroke={pal.b} strokeWidth={13 * (0.45 + 0.55 * s)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  );
  return (
    <>
      {arm(-1, Y - h * 0.4, seg(g, 0.4, 0.75), 28)}
      {arm(1, Y - h * 0.56, seg(g, 0.55, 0.9), 22)}
      <path d={`M${100 - w} ${Y}V${top + w}A${w} ${w} 0 0 1 ${100 + w} ${top + w}V${Y}Z`} fill={pal.b} />
      <path d={`M${100 + w * 0.2} ${top + w * 0.25}A${w} ${w} 0 0 1 ${100 + w} ${top + w}V${Y}H${100 + w * 0.2}Z`} fill={pal.c} opacity=".45" />
      {[-0.5, 0, 0.5].map((k) => <line key={k} x1={100 + k * w} y1={top + w * 0.8} x2={100 + k * w} y2={Y - 4} stroke={pal.a} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1 7" opacity=".8" />)}
      {f > 0 && (
        <g transform={`translate(100 ${top + 1}) scale(${f})`}>
          {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cy="-7" rx="4.5" ry="7" fill={pal.x} transform={`rotate(${r})`} />)}
          <circle r="3.4" fill="#fde68a" />
        </g>
      )}
    </>
  );
}

function Bamboo({ g, pal, dead }) {
  const stalks = [[86, 150, 0], [102, 178, 0.08], [117, 120, 0.16]];
  return stalks.map(([x, H, d], i) => {
    const h = 10 + H * seg(g, 0.03 + d, 0.85 + d * 0.9), n = Math.floor(h / 26);
    return (
      <g key={i}>
        <rect x={x - 4.5} y={Y - h} width="9" height={h} rx="3.5" fill={i === 1 ? pal.b : pal.t} />
        {[...Array(n)].map((_, j) => <rect key={j} x={x - 5.5} y={Y - (j + 1) * 26} width="11" height="2.6" rx="1.3" fill={pal.c} />)}
        {[...Array(n)].map((_, j) => {
          const s = seg(g, 0.3 + j * 0.08, 0.6 + j * 0.08) * (dead ? 0.6 : 1), dir = (i + j) % 2 ? 1 : -1;
          return s > 0 && <path key={`l${j}`} d="M0 0C8 -10 24 -10 30 -4C22 2 8 3 0 0Z" fill={pal.a} transform={`translate(${x + dir * 4} ${Y - (j + 1) * 26}) scale(${dir * s} ${s}) rotate(-18)`} />;
        })}
      </g>
    );
  });
}

function Palm({ g, pal, dead }) {
  const h = 16 + 112 * seg(g, 0.03, 0.8), tx = 100 + 12 * seg(g, 0.2, 1), ty = Y - h, s = seg(g, 0.3, 1) * (dead ? 0.7 : 1);
  const fronds = [[14, 'c'], [-18, 'b'], [-50, 'a'], [-82, 'b']];
  return (
    <>
      <path d={`M97 ${Y}Q88 ${Y - h * 0.55} ${tx} ${ty}`} stroke={pal.t} strokeWidth={5 + 5 * g} fill="none" strokeLinecap="round" />
      <Sprout x={tx} y={ty} g={g} fill={pal.a} o={1 - seg(g, 0.3, 0.5)} />
      {s > 0 && (
        <g className="leaf-breathe">
          {[1, -1].map((d) => fronds.map(([r, c], i) => (
            <path key={`${d}${i}`} d="M0 0Q30 -26 68 8Q30 -8 0 0Z" fill={pal[c]} stroke={pal[c]} strokeWidth="5" strokeLinejoin="round" transform={`translate(${tx} ${ty}) scale(${d * s} ${s}) rotate(${r})`} />
          )))}
          <circle cx={tx - 5} cy={ty + 5} r={5 * s} fill={pal.x} />
          <circle cx={tx + 6} cy={ty + 6} r={5 * s} fill={pal.x} />
        </g>
      )}
    </>
  );
}

function Willow({ g, pal, dead }) {
  const h = 14 + 100 * seg(g, 0.03, 0.75), top = Y - h, s = seg(g, 0.25, 0.9) * (dead ? 0.65 : 1), L = seg(g, 0.45, 1);
  const xs = [-46, -34, -22, -10, 2, 14, 26, 38, 48];
  return (
    <>
      <Trunk g={g} h={h} pal={pal} wMax={8} />
      <Sprout y={top + 2} g={g} fill={pal.a} o={1 - seg(g, 0.25, 0.45)} />
      {s > 0 && (
        <g transform={`translate(100 ${top - 6})`}>
          <g className="leaf-breathe">
            {xs.map((x, i) => {
              const len = (44 + ((i * 37) % 30)) * L * s;
              return len > 0 && <path key={i} d={`M${x * s} ${-4 * s}q${i % 2 ? 3 : -3} ${len * 0.5} 0 ${len}`} stroke={i % 2 ? pal.a : pal.c} strokeWidth={5.5 * s} fill="none" strokeLinecap="round" />;
            })}
            <ellipse cy={-12 * s} rx={54 * s} ry={30 * s} fill={pal.b} />
            <ellipse cx={-10 * s} cy={-22 * s} rx={30 * s} ry={15 * s} fill={pal.a} opacity=".7" />
          </g>
        </g>
      )}
    </>
  );
}

const cap = (x, s, pal, glow) => s > 0 && (
  <g transform={`translate(${x} ${Y}) scale(${s})`}>
    {glow && <circle cy="-52" r="62" fill={`url(#${glow})`} />}
    <path d="M-7 0Q-9 -30 -6 -50L6 -50Q9 -30 8 0Z" fill={pal.t} />
    <path d="M-40 -46Q-40 -86 0 -86Q40 -86 40 -46Q0 -36 -40 -46Z" fill={pal.b} />
    <path d="M-40 -46Q0 -36 40 -46Q0 -53 -40 -46Z" fill={pal.c} />
    <circle cx="-16" cy="-64" r="6" fill={pal.a} />
    <circle cx="10" cy="-72" r="4.5" fill={pal.a} />
    <circle cx="20" cy="-56" r="3.5" fill={pal.a} />
  </g>
);

function Shroom({ g, pal, dead, uid, lite }) {
  const glow = !lite && !dead && uid;
  return (
    <>
      <defs>
        <radialGradient id={uid}><stop offset="0" stopColor={pal.x} stopOpacity=".5" /><stop offset="1" stopColor={pal.x} stopOpacity="0" /></radialGradient>
      </defs>
      {cap(66, 0.5 * seg(g, 0.45, 0.8), pal, glow)}
      {cap(138, 0.62 * seg(g, 0.6, 0.95), pal, glow)}
      {cap(100, 0.3 + 1.3 * seg(g, 0.03, 0.85), pal, glow)}
    </>
  );
}

const shard = (k, x, rot, s, h, w, pal) => s > 0 && (
  <g key={k} transform={`translate(${x} ${Y}) rotate(${rot}) scale(${s})`}>
    <path d={`M0 0L${-w} ${-h * 0.28}L0 ${-h}Z`} fill={pal.b} />
    <path d={`M0 0L${w} ${-h * 0.28}L0 ${-h}Z`} fill={pal.a} />
    <path d={`M0 0L${-w} ${-h * 0.28}L0 ${-h * 0.5}Z`} fill={pal.c} opacity=".6" />
  </g>
);

function Crystal({ g, pal, dead, uid, lite }) {
  return (
    <>
      <defs>
        <radialGradient id={uid}><stop offset="0" stopColor={pal.x} stopOpacity=".45" /><stop offset="1" stopColor={pal.x} stopOpacity="0" /></radialGradient>
      </defs>
      {!lite && !dead && <circle cx="100" cy="140" r={95 * seg(g, 0.3, 1)} fill={`url(#${uid})`} />}
      {shard(1, 84, -24, seg(g, 0.4, 0.8), 80, 14, pal)}
      {shard(2, 118, 22, seg(g, 0.5, 0.9), 96, 15, pal)}
      {shard(3, 72, -48, seg(g, 0.65, 1), 46, 10, pal)}
      {shard(4, 130, 46, seg(g, 0.7, 1), 50, 10, pal)}
      {shard(0, 100, 0, 0.12 + 0.88 * seg(g, 0.03, 0.8), 160, 22, pal)}
      <path d="M68 222l8 -9 12 3 10 -6 12 5 12 -3 10 10Z" fill={pal.t} />
    </>
  );
}

const KIND = { round: Round, pine: Pine, flower: Flower, cactus: Cactus, bamboo: Bamboo, palm: Palm, willow: Willow, shroom: Shroom, crystal: Crystal };
const STARS = [[48, 72, 0], [154, 62, 0.6], [100, 26, 1.2], [36, 132, 1.7], [166, 124, 0.9]];

export default function Plant({ species, g = 1, dead = false, golden = false, sway = true, lite = false, ...rest }) {
  const sp = SP[species] || SP.oak, K = KIND[sp.kind], uid = `p${useId().replace(/[^a-z0-9]/gi, '')}`;
  const pal = dead ? DEAD : golden ? { ...sp.pal, ...GOLD } : sp.pal;
  return (
    <svg viewBox="0 0 200 240" overflow="visible" {...rest}>
      <g className={sway && !dead ? 'plant-sway' : undefined} style={{ transformOrigin: '100px 222px' }} transform={dead ? 'rotate(6 100 222)' : undefined}>
        <K g={dead ? Math.max(g, 0.3) : g} pal={pal} dead={dead} uid={uid} lite={lite} dots={sp.dots} snow={sp.snow} />
      </g>
      {golden && !dead && g > 0.9 && STARS.map(([x, y, d], i) => (
        <path key={i} className="twinkle" style={{ animationDelay: `${d}s` }} d="M0 -7L1.6 -1.6L7 0L1.6 1.6L0 7L-1.6 1.6L-7 0L-1.6 -1.6Z" transform={`translate(${x} ${y})`} fill="#fffbeb" />
      ))}
    </svg>
  );
}
