// tg-auth va tg-bot uchun umumiy yordamchilar (kutubxonasiz)
const crypto = require('crypto');
const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const json = (code, o) => ({ statusCode: code, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(o) });
const SID = /^[0-9a-f]{32}$/;

function sa() { try { const o = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ''); return o && o.private_key ? o : null; } catch { return null; } }
const sign = (data, key) => b64u(crypto.createSign('RSA-SHA256').update(data).sign(key));

function customToken(s, uid, claims) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: s.client_email, sub: s.client_email, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: now, exp: now + 3600, uid, claims }));
  return `${head}.${body}.${sign(`${head}.${body}`, s.private_key)}`;
}
async function gToken(s) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: s.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 }));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sign(`${head}.${body}`, s.private_key)}` }) });
  const j = await r.json(); if (!j.access_token) throw new Error('Google token olinmadi');
  return j.access_token;
}
const docUrl = (s, sid) => `https://firestore.googleapis.com/v1/projects/${s.project_id}/databases/(default)/documents/tglogin/${sid}`;
const str = v => ({ stringValue: String(v) }), int = v => ({ integerValue: String(v) });

module.exports = { crypto, b64u, eq, json, SID, sa, customToken, gToken, docUrl, str, int };
