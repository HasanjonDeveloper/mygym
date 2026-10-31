// Telegram -> Firebase custom token. Kutubxonasiz (faqat Node crypto).
// Env: BOT_TOKEN, FIREBASE_SERVICE_ACCOUNT (JSON), BOT_USERNAME (ixtiyoriy, brauzerdagi "Telegram bilan kirish" tugmasi uchun)
const crypto = require('crypto');
const MAX_AGE = 24 * 3600;   // initData eskirish muddati (soniya)

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const json = (code, o) => ({ statusCode: code, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(o) });

// Mini App: initData (query string)
function checkInitData(raw, token) {
  const p = new URLSearchParams(raw), hash = p.get('hash'); if (!hash) return null;
  p.delete('hash');
  const str = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const calc = hmac(hmac('WebAppData', token), str).toString('hex');
  if (!eq(calc, hash)) return null;
  if (Date.now() / 1000 - Number(p.get('auth_date')) > MAX_AGE) return null;
  try { return JSON.parse(p.get('user')); } catch { return null; }
}
// Brauzer: Telegram Login Widget ob'ekti
function checkWidget(o, token) {
  if (!o || !o.hash) return null;
  const str = Object.keys(o).filter(k => k !== 'hash').sort().map(k => `${k}=${o[k]}`).join('\n');
  const calc = crypto.createHmac('sha256', crypto.createHash('sha256').update(token).digest()).update(str).digest('hex');
  if (!eq(calc, String(o.hash))) return null;
  if (Date.now() / 1000 - Number(o.auth_date) > MAX_AGE) return null;
  return o;
}
function customToken(sa, uid, claims) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({
    iss: sa.client_email, sub: sa.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 3600, uid, claims,
  }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key);
  return `${head}.${body}.${b64u(sig)}`;
}

exports.handler = async (ev) => {
  if (ev.httpMethod === 'GET') return json(200, { bot: process.env.BOT_USERNAME || '' });
  if (ev.httpMethod !== 'POST') return json(405, { error: 'method' });
  const token = process.env.BOT_TOKEN; let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ''); } catch { /* */ }
  if (!token || !sa || !sa.private_key) return json(500, { error: 'Server sozlanmagan (BOT_TOKEN / FIREBASE_SERVICE_ACCOUNT)' });
  let b; try { b = JSON.parse(ev.body || '{}'); } catch { return json(400, { error: 'json' }); }
  const u = b.initData ? checkInitData(String(b.initData), token) : b.widget ? checkWidget(b.widget, token) : null;
  if (!u || !u.id) return json(401, { error: 'Telegram imzosi noto\'g\'ri yoki eskirgan' });
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || String(u.id);
  return json(200, { token: customToken(sa, 'tg_' + u.id, { tg: true }), name });
};
