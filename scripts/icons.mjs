// Renders the app icon to PNG with no dependencies (signed-distance shapes + supersampling).
import zlib from 'node:zlib';
import fs from 'node:fs';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
const leaf = (u, v, px, py, qx, qy, k) => {
  const mx = (px + qx) / 2, my = (py + qy) / 2, dx = qx - px, dy = qy - py, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L, R = Math.hypot(L / 2, k);
  return Math.max(Math.hypot(u - mx - nx * k, v - my - ny * k), Math.hypot(u - mx + nx * k, v - my + ny * k)) - R;
};
const capsule = (u, v, ax, ay, bx, by, r) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - ax - dx * t, v - ay - dy * t) - r;
};
function color(u, v) {
  let c = mix(hex('#123f31'), hex('#050908'), Math.hypot(u - 0.5, v - 0.42) / 0.62);
  if (capsule(u, v, 0.5, 0.84, 0.5, 0.52, 0.03) < 0) c = hex('#34d399');
  if (leaf(u, v, 0.5, 0.56, 0.2, 0.3, 0.13) < 0) c = mix(hex('#10b981'), hex('#5eead4'), (0.56 - v) / 0.3);
  if (leaf(u, v, 0.5, 0.6, 0.82, 0.24, 0.16) < 0) c = mix(hex('#34d399'), hex('#a7f3d0'), (0.6 - v) / 0.4);
  return c;
}
function png(size) {
  const row = size * 4 + 1, raw = Buffer.alloc(row * size), N = 3;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let acc = [0, 0, 0];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const c = color((x + (i + 0.5) / N) / size, (y + (j + 0.5) / N) / size);
      acc = acc.map((v, k) => v + c[k]);
    }
    const o = y * row + 1 + x * 4;
    raw[o] = acc[0] / 9; raw[o + 1] = acc[1] / 9; raw[o + 2] = acc[2] / 9; raw[o + 3] = 255;
  }
  const chunk = (t, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [180, 192, 512]) fs.writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), png(s));
console.log('icons written');
