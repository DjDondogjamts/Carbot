const send = require('./send');
const flows = require('./flows');
const config = require('../config/global');
const db = require('../config/db');

exports.verify = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
};

const getOrCreateUser = async (fbId) => {
  await db.query(`INSERT INTO users (fb_id) VALUES ($1) ON CONFLICT DO NOTHING`, [fbId]);
  return (await db.query(`SELECT * FROM users WHERE fb_id=$1`, [fbId])).rows[0];
};

const getLatestSession = async (userId) => {
  return (await db.query(`SELECT * FROM sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId])).rows[0];
};

const handlePostback = async (userId, payload) => {
  const user = await getOrCreateUser(userId);
  if (payload.startsWith('CAT_')) return flows.sendTierMenu(userId, payload.replace('CAT_', '').toLowerCase());
  if (payload.startsWith('TIER_')) return flows.saveTierAndSendPayment(userId, payload);
  if (payload === 'ZURKHAI_YES') {
    const session = await getLatestSession(user.id);
    if (session) await db.query(`UPDATE sessions SET zurkhai_opt_in=true WHERE id=$1`, [session.id]);
    return send.text(userId, '✅ Тодорхой! Төрсөн он сар өдөр, хүйсээ бичнэ үү — жишээ: `1990-05-15 эрэгтэй`');
  }
  if (payload === 'ZURKHAI_NO') {
    const session = await getLatestSession(user.id);
    if (session) {
      await db.query(`UPDATE sessions SET zurkhai_opt_in=false WHERE id=$1`, [session.id]);
      return flows.askCategoryQuestions(userId, session.category);
    }
    return flows.sendWelcome(userId);
  }
  if (payload.startsWith('RATE_')) {
    const rating = parseInt(payload.replace('RATE_', ''), 10);
    const session = await getLatestSession(user.id);
    if (session) await db.query(`INSERT INTO feedback (session_id, rating) VALUES ($1,$2)`, [session.id, rating]);
    return send.text(userId, `🙏 Баярлалаа! Таны ${rating} оноо бидэнд үйлчилгээгээ сайжруулахад маш чухал юм!`);
  }
  return flows.sendWelcome(userId);
};

const handleMessage = async (userId, message) => {
  await send.markSeen(userId);
  const user = await getOrCreateUser(userId);
  const session = await getLatestSession(user.id);
  const text = (message.text || '').toString().trim();
  const lower = text.toLowerCase();

  if (!session || !session.category) return flows.sendWelcome(userId);

  // Media limit check
  const tierConfig = await config.getTierConfig(session.tier || 0);
  const imageCount = Object.values(session.answers || {}).filter(a => a.attachments?.length).length;
  if (message.attachments?.length && imageCount >= tierConfig.max_images) {
    return send.text(userId, `⚠️ Уучлаарай, энэ түвшинд хамгийн ихдээ ${tierConfig.max_images} зураг илгээх боломжтой. Хэрэв нэмэлт зураг хэрэгтэй бол дээд түвшний үйлчилгээг сонгоно уу.`);
  }

  // Zurkhai birth date/gender collection
  if ((session.tier === 2 || session.tier === 4) && session.zurkhai_opt_in === null) {
    if (lower === 'алгасах') {
      await db.query(`UPDATE sessions SET zurkhai_opt_in=false WHERE id=$1`, [session.id]);
      return flows.askCategoryQuestions(userId, session.category);
    }
    const dateMatch = text.match(/(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/);
    if (dateMatch) {
      const birthDate = dateMatch[0];
      const gender = text.includes('эрэгтэй') ? 'эрэгтэй' : text.includes('эмэгтэй') ? 'эмэгтэй' : null;
      await db.query(`UPDATE users SET birth_date=$1, gender=$2 WHERE id=$3`, [birthDate, gender, user.id]);
      await db.query(`UPDATE sessions SET zurkhai_opt_in=true WHERE id=$1`, [session.id]);
      return flows.askCategoryQuestions(userId, session.category);
    }
  }

  if (!session.paid) {
    return send.text(userId, `⏳ Төлбөр хүлээгдэж байна. QR код уншуулж шилжүүлсний дараа автоматаар нээгдэнэ.\nХэрэв 1 минутаас удаан хүлээсэн бол бидэнтэй холбогдоно уу.`);
  }

  if (lower === 'тайлан гарга') return flows.generateAndSendReport(userId, session);

  await flows.saveAnswer(session, message);
  return send.text(userId, `✅ Хадгалагдлаа! Бусад мэдээлэл, зураг байвал үргэлжлүүлэн илгээнэ үү.\nБүх зүйл дууссан бол **"Тайлан гарга"** гэж бичнэ үү.`);
};

exports.handleIncoming = async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
  const body = req.body;
  if (body.object !== 'page') return;
  for (const entry of body.entry || []) {
    for (const evt of entry.messaging || []) {
      const uid = evt.sender?.id;
      if (!uid) continue;
      try {
        if (evt.postback) await handlePostback(uid, evt.postback.payload);
        else if (evt.message) await handleMessage(uid, evt.message);
      } catch (err) {
        console.error('Webhook event error:', err.message);
      }
    }
  }
};
