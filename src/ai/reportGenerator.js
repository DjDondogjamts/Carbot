const kimi = require('./kimi');
const zurkhai = require('./zurkhai');
const config = require('../config/global');
const db = require('../config/db');

exports.generate = async (categoryPrompt, session) => {
  const tierConfig = await config.getTierConfig(session.tier);
  let zurkhaiSection = '';

  if (tierConfig.enable_zurkhai && session.zurkhai_opt_in) {
    const user = (await db.query(`SELECT birth_date, gender FROM users WHERE id=$1`, [session.user_id])).rows[0];
    if (user?.birth_date) {
      zurkhaiSection = `\n\n🔮 МАШИН ХУДАЛДАН АВАХ ЗУРХАЙН ЗӨВЛӨГӨӨ (Гандан хийдийн стандарт):\n${await zurkhai.generate(user.birth_date, user.gender, session)}`;
    }
  }

  const flatAnswers = Object.entries(session.answers || {})
    .map(([k, v]) => {
      const t = typeof v === 'string' ? v : v?.text || v?.caption || (v.attachments ? '[зураг/файл]' : JSON.stringify(v));
      return `- ${t}`;
    })
    .join('\n');

  const fullPrompt = `
=== АВТОМАШИНЫ ТАЙЛАН ===
Ангилал: ${session.category}
Түвшин: ${session.tier} (${session.tier_name || ''})

${categoryPrompt}

--- ХЭРЭГЛЭГЧИЙН ӨГСӨН МЭДЭЭЛЭЛ:
${flatAnswers || 'Мэдээлэл ороогүй'}
${zurkhaiSection}

--- ТАЙЛАНГИЙН ШААРДЛАГА:
1. Toyota 3S стандарт дагаж бичнэ
2. 800-2000 тэмдэгт, цэгцэл, хэсэгт хуваана
3. Бүх эрсдэл, согогийг ил тод бичнэ
4. Эцэст нь тодорхой зөвлөгөө өгнө: худалдаж авах / хямдруулах / татгалзах
`;

  return kimi.call(fullPrompt, 'report', session.id, {
    temperature: 0.2,
    maxTokens: tierConfig.max_tokens,
    largeModel: session.tier >= 3
  });
};
