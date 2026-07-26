const send = require('./send');
const questions = require('./questions');
const prompts = require('../config/prompts');
const reportGen = require('../ai/reportGenerator');
const config = require('../config/global');
const db = require('../config/db');

const TIER_MAP = {
  0: { name: 'Үнэ харьцуулах' },
  1: { name: 'Мэргэжлийн зөвлөгөө' },
  2: { name: 'Аз таарулалт' },
  3: { name: 'Бүрэн баталгаажсан тайлан' },
  4: { name: 'Бүрэн тайлан + гүнзгий зурхай' }
};

const CAT_NAMES = { imported: 'Орж ирсэн', new: 'Шинэ', used: 'Хуучин' };

exports.sendWelcome = async (userId) => {
  const cfg = await config.loadDbConfig();
  let greeting = '🤝 Сайн уу? CarBot-той танилцсандаа баярлалаа!';
  if (cfg.toyotaSteps.greeting) {
    greeting += `\nБид Toyota үйлчилгээний 3S стандарт (Оновчтой, Эелдэг, Итгэлцэлтэй)-ын дагуу танд автомашины бүрэн шалгалт, үнэ харьцуулалт, зөвлөгөөг 1 минутанд гаргаж өгнө.`;
  }
  greeting += '\nТа ямар төрлийн машин шалгах вэ?';
  return send.text(userId, greeting, [
    { title: '🚢 Орж ирсэн', payload: 'CAT_IMPORTED' },
    { title: '✨ Шинэ', payload: 'CAT_NEW' },
    { title: '🛠️ Хуучин', payload: 'CAT_USED' }
  ]);
};

exports.sendTierMenu = async (userId, category) => {
  const cat = String(category).toLowerCase();
  await db.query(
    `INSERT INTO sessions (user_id, category) VALUES ((SELECT id FROM users WHERE fb_id=$1), $2)`,
    [userId, cat]
  );
  const tiers = await db.query('SELECT tier, tier_name, price FROM service_tiers ORDER BY tier');
  return send.text(userId,
    `✅ Сонгосон ангилал: **${CAT_NAMES[cat] || cat}**\nДоорх үйлчилгээнээс сонгоно уу:`,
    tiers.rows.map(t => ({
      title: `${t.price.toLocaleString()}₮ ${t.tier_name}`,
      payload: `TIER_${t.tier}`
    }))
  );
};

exports.saveTierAndSendPayment = async (userId, tierKey) => {
  const tierNum = parseInt(tierKey.replace('TIER_', ''));
  const tier = await config.getTierConfig(tierNum);
  const s = (await db.query(
    `UPDATE sessions SET tier=$1, tier_name=$2, amount=$3
     WHERE user_id=(SELECT id FROM users WHERE fb_id=$4) AND paid=false
     RETURNING *`,
    [tier.tier, tier.tier_name, tier.price, userId]
  )).rows[0];
  if (!s) return;
  const cfg = await config.loadDbConfig();
  await send.image(userId, `${cfg.railwayUrl}/assets/qr_khanbank.png`);
  let msg = `💳 Сонгосон үйлчилгээ: **${tier.tier_name}**\n💰 Төлбөр: **${tier.price.toLocaleString()}₮**\n\n⚠️ ЧУХАЛ:`;
  msg += `\n1. QR кодыг уншаад Ханбанк дансанд мөнгөө шилжүүлнэ үү`;
  msg += `\n2. **Гүйлгээний утга хэсэгт ЗӨВХӨН ӨӨРИЙН УТАСНЫ ДУГААРАА** бичнэ үү (9-ээр эхлэх 8 оронтой, жишээ: 99111234)`;
  msg += `\n3. Шилжүүлсний дараа 5-30 секунд хүлээнэ үү — төлбөр автоматаар баталгаажна!`;
  return send.text(userId, msg);
};

exports.askZurkhaiConsent = async (userId) => {
  return send.text(userId,
    `🤗 Нэмэлтээр машин худалдан авахтай холбоотой зурхайн зөвлөгөө авахыг хүсч байна уу?
✅ **Хүсвэл**: Төрсөн он сар өдөр, хүйсээ бичнэ үү — жишээ: \`1990-05-15 эрэгтэй\`
❌ **Хүсэхгүй бол**: **"Алгасах"** гэж бичнэ үү — зөвхөн техникийн тайлан гаргана.

💡 Зөвлөгөө нь Гандан хийдийн стандарт, gogo.mn цаг тооны бичгийн дагуу байх бөгөөд зөвхөн машинтай холбоотой зүйлсийг л хэлнэ.`,
    [
      { title: '✅ Шалгах', payload: 'ZURKHAI_YES' },
      { title: '❌ Алгасах', payload: 'ZURKHAI_NO' }
    ]
  );
};

exports.askCategoryQuestions = async (userId, category) => {
  const cfg = await config.loadDbConfig();
  const qs = questions.getForCategory(category);
  let msg = `✅ Төлбөр амжилттай баталгаажлаа! 🎉`;
  if (cfg.toyotaSteps.docReminder) {
    msg += `\n💡 Зургийг тод, бүрэн хэмжээгээр авч илгээнэ үү — бид илүү нарийвчлалтай шалгаж чадна.`;
  }
  msg += `\nОдоо доорх асуултуудын хариуг, зураг баримтуудыг дарааллаар илгээнэ үү.`;
  msg += `\nБүх мэдээлэл дууссан бол эцэст **"Тайлан гарга"** гэж бичнэ үү — бид 1 минутанд бэлэн болгоно.`;
  await send.text(userId, msg);
  for (const q of qs) await send.text(userId, q);
};

exports.generateAndSendReport = async (userId, session) => {
  await send.typingOn(userId);
  try {
    const prompt = await prompts.get(session.category, session.tier);
    const report = await reportGen.generate(prompt, session);
    await send.text(userId, report);
    await db.query(`UPDATE sessions SET report_text=$1 WHERE id=$2`, [report, session.id]);
  } finally {
    await send.typingOff(userId);
  }
  return exports.sendFeedbackRequest(userId);
};

exports.sendFeedbackRequest = async (userId) => {
  await send.text(userId,
    `✅ Тайлан бэлэн боллоо! Toyota үйлчилгээний стандартын дагуу бид таны сэтгэл ханамжийг чухалчилж байна.
Үйлчилгээ хэрхэн таалагдсан бэ? 1-5 оноо өгнө үү:`,
    [
      { title: '⭐ 1', payload: 'RATE_1' },
      { title: '⭐⭐ 2', payload: 'RATE_2' },
      { title: '⭐⭐⭐ 3', payload: 'RATE_3' },
      { title: '⭐⭐⭐⭐ 4', payload: 'RATE_4' },
      { title: '⭐⭐⭐⭐⭐ 5', payload: 'RATE_5' }
    ]
  );
  return send.text(userId,
    `💡 Сайжруулах зүйл, нэмэлт асуулт байвал чөлөөтэй бичнэ үү!
👥 Найзад санал болговол НЭГ ҮНЭГҮЙ ШАЛГАЛТ авах эрхтэй болно!`
  );
};

exports.saveAnswer = async (session, message) => {
  const merged = { ...(session.answers || {}), [Date.now()]: message };
  await db.query(`UPDATE sessions SET answers=$1 WHERE id=$2`, [merged, session.id]);
};
