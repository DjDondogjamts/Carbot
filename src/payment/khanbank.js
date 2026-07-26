const db = require('../config/db');
const discord = require('../alerts/discord');
const flows = require('../messenger/flows');
const send = require('../messenger/send');
const kimi = require('../ai/kimi');
const prompts = require('../config/prompts');
const config = require('../config/global');

const KEYWORDS = /ханбанк|гүйлгээ|шилжүүлэг|хүлээн авлаа|карт|данс|орлого/i;

const parseSms = async (rawText) => {
  const p = await prompts.get('payment', 'parse');
  const filled = p.replace('{{SMS}}', String(rawText));
  const out = await kimi.call(filled, 'payment_parse', null, { temperature: 0, maxTokens: 500 });
  try {
    return JSON.parse(out.replace(/```json|```/g, '').trim());
  } catch (e) {
    return { amount: null, phone: null, note: out, date: null, confidence: 0 };
  }
};

const matchSession = async (parsed) => {
  const cfg = await config.loadDbConfig();
  const sessions = (await db.query(`
    SELECT s.id, s.user_id, s.tier, s.tier_name, s.amount, s.paid, u.fb_id, u.phone user_phone
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.paid=false AND s.amount IS NOT NULL AND s.created_at > NOW() - ($1 || ' hours')::INTERVAL
    ORDER BY s.created_at DESC
  `, [cfg.sessionValidHours])).rows;
  if (!sessions.length) return null;
  const p = await prompts.get('payment', 'match', {
    TOLERANCE: cfg.paymentTolerance,
    VALID_HOURS: cfg.sessionValidHours
  });
  const filled = p
    .replace('{{PARSED}}', JSON.stringify(parsed))
    .replace('{{SESSIONS}}', JSON.stringify(sessions.map(s => ({
      id: s.id, tier: s.tier, amount: s.amount, user_phone: s.user_phone
    }))));
  const out = await kimi.call(filled, 'payment_match', null, { temperature: 0, maxTokens: 500 });
  try {
    return { decision: JSON.parse(out.replace(/```json|```/g, '').trim()), sessions };
  } catch (e) {
    return { decision: { action: 'WARN', session_id: null, reason: 'AI match parse failed' }, sessions };
  }
};

exports.handleSMS = async (req, res) => {
  res.status(200).send('OK');
  const cfg = await config.loadDbConfig();
  // Secret key validation
  if (cfg.smsForwardSecret && req.query.secret !== cfg.smsForwardSecret) return;

  const raw = String(
    req.body?.text || req.body?.message || req.body?.sms || req.body?.content ||
    Object.values(req.body || {}).find(v => typeof v === 'string' && KEYWORDS.test(v)) || ''
  ).trim();
  // Lightweight pre-filter to save tokens
  if (!raw || !KEYWORDS.test(raw)) return;
  const receivedAt = Date.now();

  const parsed = await parseSms(raw);
  const delaySec = parsed.date ? Math.max(0, Math.floor((receivedAt - new Date(parsed.date).getTime()) / 1000)) : null;
  const bs = (await db.query(
    `INSERT INTO bank_sms (phone, amount, sms_text, parsed_json, delay_seconds) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [parsed.phone || null, parsed.amount ? Number(parsed.amount) : null, raw, parsed, delaySec]
  )).rows[0];

  if (!parsed.amount) {
    await discord.paymentMismatch(null, null, 0);
    return;
  }

  const match = await matchSession(parsed);
  if (!match) {
    await discord.paymentMismatch(parsed.phone, null, parsed.amount);
    return;
  }
  const { decision, sessions } = match;
  await db.query(
    `INSERT INTO payment_decisions (sms_id, session_id, decision, reason, confidence) VALUES ($1,$2,$3,$4,$5)`,
    [bs.id, decision.session_id, decision.action, decision.reason, parsed.confidence || 0]
  );

  const target = sessions.find(s => s.id === decision.session_id);

  switch (decision.action) {
    case 'APPROVE': {
      if (!target) break;
      await db.query(`UPDATE sessions SET paid=true, paid_at=NOW() WHERE id=$1`, [target.id]);
      await db.query(
        `INSERT INTO payments (session_id, phone, amount, status, matched_by) VALUES ($1,$2,$3,'paid','ai')`,
        [target.id, parsed.phone || target.user_phone, Number(parsed.amount)]
      );
      await discord.newSale(parsed.amount, target.tier_name, parsed.phone || target.user_phone);
      await send.text(target.fb_id, `✅ Төлбөр амжилттай баталгаажлаа! **${Number(parsed.amount).toLocaleString()}₮**`);
      const tierConfig = await config.getTierConfig(target.tier);
      return tierConfig.enable_zurkhai
        ? flows.askZurkhaiConsent(target.fb_id)
        : flows.askCategoryQuestions(target.fb_id, target.category);
    }
    case 'PARTIAL': {
      if (!target) break;
      const diff = (target.amount || 0) - Number(parsed.amount);
      await discord.send('⚠️ ИРМЭГ ДҮН', `Утас: ${parsed.phone || 'N/A'}\nХүлээгдэж: ${target.amount}₮\nИрсэн: ${parsed.amount}₮\nҮлдэгдэл: ${diff}₮`, 'warn');
      return send.text(target.fb_id,
        `⚠️ Төлбөр дүн бага ирсэн байна.\nХүлээгдэж байсан: **${target.amount.toLocaleString()}₮**\nИрсэн: **${Number(parsed.amount).toLocaleString()}₮**\nҮлдэгдэл: **${diff.toLocaleString()}₮**\n\nҮлдэгдлийг нэмж төлөх эсвэл бидэнтэй холбогдоно уу.`
      );
    }
    case 'WARN':
      return discord.paymentMismatch(parsed.phone, 'сесс олдсонгүй', parsed.amount);
    default:
      return discord.send('❌ Төлбөр тохирохгүй', `SMS: ${raw.substring(0, 200)}\nШалтгаан: ${decision.reason}`, 'error');
  }
};

// Manual payment override for admin
exports.manualApprove = async (sessionId, reason) => {
  const session = (await db.query(`SELECT * FROM sessions WHERE id=$1`, [sessionId])).rows[0];
  if (!session || session.paid) throw new Error('Session not found or already paid');
  await db.query(`UPDATE sessions SET paid=true, paid_at=NOW() WHERE id=$1`, [sessionId]);
  await db.query(`INSERT INTO payments (session_id, amount, status, matched_by) VALUES ($1,$2,'paid','manual')`, [sessionId, session.amount]);
  await db.query(`INSERT INTO manual_payment_overrides (session_id, reason) VALUES ($1,$2)`, [sessionId, reason]);
  const user = (await db.query(`SELECT fb_id FROM users WHERE id=$1`, [session.user_id])).rows[0];
  await discord.send('✅ Гараар төлбөр баталгаажууллаа', `Сесс: #${sessionId}\nДүн: ${session.amount}₮\nШалтгаан: ${reason}`, 'success');
  await send.text(user.fb_id, `✅ Төлбөр админаар баталгаажлаа!`);
  const tierConfig = await config.getTierConfig(session.tier);
  return tierConfig.enable_zurkhai
    ? flows.askZurkhaiConsent(user.fb_id)
    : flows.askCategoryQuestions(user.fb_id, session.category);
};
