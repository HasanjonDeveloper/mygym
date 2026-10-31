// Telegram bot webhook: "/start <sid>" -> 6 xonali kirish kodi yuboradi (kodni saytga kiritasiz).
// Birinchi marta: <sayt>/.netlify/functions/tg-bot?setup=1 ni oching (webhookni o'rnatadi).
const { crypto, eq, json, SID, sa, gToken, docUrl, str, int } = require('./lib/common');

const secret = t => crypto.createHash('sha256').update('wh:' + t).digest('hex').slice(0, 32);
const site = () => process.env.URL || 'https://my-gym-track.netlify.app';
const api = (t, m, body) => fetch(`https://api.telegram.org/bot${t}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const openBtn = { inline_keyboard: [[{ text: 'GymTrack ni ochish', web_app: { url: site() } }]] };

exports.handler = async (ev) => {
  const token = process.env.BOT_TOKEN; if (!token) return json(500, { error: 'BOT_TOKEN yo\'q' });
  if (ev.httpMethod === 'GET') {
    if (!(ev.queryStringParameters || {}).setup) return json(200, { ok: true });
    const host = ev.headers['x-forwarded-host'] || ev.headers.host;
    const r = await api(token, 'setWebhook', { url: `https://${host}/.netlify/functions/tg-bot`, secret_token: secret(token), allowed_updates: ['message'] });
    return json(200, { ok: !!r.ok, description: r.description });
  }
  if (!eq(String(ev.headers['x-telegram-bot-api-secret-token'] || ''), secret(token))) return json(401, { error: 'secret' });
  let u; try { u = JSON.parse(ev.body || '{}'); } catch { return json(200, {}); }
  const m = u.message; if (!m || !m.text || !m.from || m.chat.type !== 'private') return json(200, {});
  const mm = m.text.match(/^\/start(?:\s+(\S+))?/); if (!mm) return json(200, {});
  const sid = mm[1];
  try {
    if (!SID.test(sid || '')) {
      await api(token, 'sendMessage', { chat_id: m.chat.id, text: 'GymTrack botiga xush kelibsiz! Ilovani ochish uchun pastdagi tugmani bosing. Saytga kirish kodi kerak bo\'lsa, saytdagi "Telegram orqali kirish" tugmasini bosing.', reply_markup: openBtn });
      return json(200, {});
    }
    const s = sa(); if (!s) throw new Error('FIREBASE_SERVICE_ACCOUNT');
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const name = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') || m.from.username || String(m.from.id);
    const at = await gToken(s);
    const r = await fetch(docUrl(s, sid), { method: 'PATCH', headers: { authorization: 'Bearer ' + at, 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { uid: str('tg_' + m.from.id), name: str(name), code: str(code), tries: int(0), exp: int(Date.now() + 5 * 60 * 1000) } }) });
    if (!r.ok) throw new Error('Firestore ' + r.status);
    await api(token, 'sendMessage', { chat_id: m.chat.id, parse_mode: 'HTML', text: `Saytga kirish kodi: <code>${code}</code>\n\nUni saytdagi oynaga kiriting. Kod 5 daqiqa amal qiladi. Bu so'rovni siz boshlamagan bo'lsangiz, e'tibor bermang.`, reply_markup: openBtn });
  } catch (e) {
    await api(token, 'sendMessage', { chat_id: m.chat.id, text: 'Kod yaratib bo\'lmadi. Keyinroq qayta urinib ko\'ring.' }).catch(() => {});
  }
  return json(200, {});
};
