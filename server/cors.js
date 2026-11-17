// Lets the app on GitHub Pages call this API on Vercel.
//
// Browsers block a page on one site from reading responses from another site unless
// that other site says it's allowed (CORS). We allow only our own app's addresses.
const DEFAULT_ORIGINS = ['https://guanliang9.github.io'];

const allowed = () => [...DEFAULT_ORIGINS, ...(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)];

// Returns true when the request was a CORS "preflight" that has now been answered.
export function cors(req, res) {
  const origin = req.headers?.origin;
  if (origin && allowed().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return true; }
  return false;
}
