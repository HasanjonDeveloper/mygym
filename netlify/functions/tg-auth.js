// Telegram -> Firebase custom token. Kutubxonasiz (faqat Node crypto).
// Env: BOT_TOKEN, FIREBASE_SERVICE_ACCOUNT (JSON), BOT_USERNAME (ixtiyoriy, brauzerdagi "Telegram bilan kirish" tugmasi uchun)
const { crypto, b64u, eq, json, SID, sa, customToken, gToken, docUrl, str, int } = require('./lib/common');
const MAX_AGE = 24 * 3600;   // initData eskirish muddati (soniya)
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
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
exports.handler = async (ev) => {
  if (ev.httpMethod === 'GET') return json(200, { bot: process.env.BOT_USERNAME || '', app: process.env.BOT_APP || '' });
  if (ev.httpMethod !== 'POST') return json(405, { error: 'method' });
  const token = process.env.BOT_TOKEN; let sa; const sa_ = require('./lib/common').sa;
  sa = sa_();
  if (!token || !sa || !sa.private_key) return json(500, { error: 'Server sozlanmagan (BOT_TOKEN / FIREBASE_SERVICE_ACCOUNT)' });
  let b; try { b = JSON.parse(ev.body || '{}'); } catch { return json(400, { error: 'json' }); }
  try {
    // Mini App: sinov xabari
    if (b.action === 'test') {
      const u = checkInitData(String(b.initData || ''), token);
      if (!u || !u.id) return json(401, { error: 'Telegram imzosi noto\'g\'ri' });
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: u.id, text: 'Sinov xabari ✅ Mashg\'ulot eslatmalari shu chatga keladi. Baland eshitilishi uchun: chat → bot nomi → Bildirishnomalar → Sozlash (ovoz va ustuvorlik).' }) });
      return r.ok ? json(200, { ok: true }) : json(502, { error: 'Telegram ' + r.status });
    }
    // Brauzer: bot yuborgan 6 xonali kodni tekshiradi
    if (b.action === 'verify') {
      if (!SID.test(b.sid || '') || !/^\d{6}$/.test(String(b.code || ''))) return json(400, { error: 'Kod 6 ta raqamdan iborat bo\'lishi kerak' });
      const at = await gToken(sa), url = docUrl(sa, b.sid), H = { authorization: 'Bearer ' + at };
      const r = await fetch(url, { headers: H });
      if (r.status === 404) return json(401, { error: 'Kod topilmadi yoki eskirgan. Qaytadan boshlang.' });
      if (!r.ok) return json(502, { error: 'O\'qilmadi (' + r.status + ')' });
      const d = (await r.json()).fields || {}, tries = Number(d.tries && d.tries.integerValue || 0);
      if (!d.code || Number(d.exp && d.exp.integerValue) < Date.now()) { await fetch(url, { method: 'DELETE', headers: H }); return json(401, { error: 'Kod eskirgan. Qaytadan boshlang.' }); }
      if (!eq(d.code.stringValue, String(b.code))) {
        if (tries + 1 >= 5) await fetch(url, { method: 'DELETE', headers: H });
        else await fetch(url + '?updateMask.fieldPaths=tries', { method: 'PATCH', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ fields: { tries: int(tries + 1) } }) });
        return json(401, { error: tries + 1 >= 5 ? 'Juda ko\'p xato. Qaytadan boshlang.' : 'Kod noto\'g\'ri' });
      }
      await fetch(url, { method: 'DELETE', headers: H });   // bir martalik
      return json(200, { token: customToken(sa, d.uid.stringValue, { tg: true }), name: d.name.stringValue });
    }
  } catch (e) { return json(500, { error: String(e.message || e) }); }
  const u = b.initData ? checkInitData(String(b.initData), token) : b.widget ? checkWidget(b.widget, token) : null;
  if (!u || !u.id) return json(401, { error: 'Telegram imzosi noto\'g\'ri yoki eskirgan' });
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || String(u.id);
  return json(200, { token: customToken(sa, 'tg_' + u.id, { tg: true }), name });
};
