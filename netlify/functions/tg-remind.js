// Rejalashtirilgan funksiya (netlify.toml): har 10 daqiqada ishlaydi va eslatmasi yoqilgan
// Telegram foydalanuvchilariga bot orqali "mashg'ulot vaqti" xabarini yuboradi. Ilova yopiq bo'lsa ham ishlaydi.
const { json, sa, gToken, colUrl, str } = require('./lib/common');
const TZ = process.env.REMIND_TZ || 'Asia/Tashkent', WINDOW = 90;   // belgilangan vaqtdan keyin 90 daqiqagacha yuboradi

function nowIn(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
const DAYN = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

exports.handler = async () => {
  const token = process.env.BOT_TOKEN, s = sa(); if (!token || !s) return json(500, { error: 'sozlanmagan' });
  const at = await gToken(s), H = { authorization: 'Bearer ' + at }, n = nowIn(TZ);
  const site = process.env.URL || 'https://my-gym-track.netlify.app';
  let sent = 0, page = '';
  do {
    const r = await fetch(`${colUrl(s, 'gymtrack')}?pageSize=100&mask.fieldPaths=data${page ? '&pageToken=' + page : ''}`, { headers: H });
    if (!r.ok) return json(502, { error: 'list ' + r.status });
    const j = await r.json(); page = j.nextPageToken || '';
    for (const d of j.documents || []) {
      const uid = d.name.split('/').pop(); if (!/^tg_\d+$/.test(uid)) continue;
      let data; try { data = JSON.parse(d.fields.data.stringValue); } catch { continue; }
      const p = data.profile || {};
      if (!p.remindOn || !Array.isArray(p.remindDays) || !p.remindDays.includes(n.dow)) continue;
      const [h, m] = String(p.remindTime || '18:00').split(':').map(Number), t = h * 60 + m;
      if (n.min < t || n.min >= t + WINDOW) continue;
      if ((data.workouts || []).some(w => w.date === n.date)) continue;               // bugun mashq qilgan
      const lr = await fetch(`${colUrl(s, 'tgremind')}/${uid}`, { headers: H });
      if (lr.ok && ((await lr.json()).fields || {}).last?.stringValue === n.date) continue;   // bugun yuborilgan
      const tr = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        chat_id: uid.slice(3), text: `Mashg'ulot vaqti! 💪\nBugun ${DAYN[n.dow]} — mashq kuni. Boshlaymizmi?`,
        reply_markup: { inline_keyboard: [[{ text: 'GymTrack ni ochish', web_app: { url: site } }]] } }) });
      if (tr.ok) { sent++; await fetch(`${colUrl(s, 'tgremind')}/${uid}`, { method: 'PATCH', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ fields: { last: str(n.date) } }) }); }
    }
  } while (page);
  return json(200, { sent });
};
