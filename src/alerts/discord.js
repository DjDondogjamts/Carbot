const axios = require('axios');
const config = require('../config/global');

const COLORS = { info: 3447003, success: 5763719, warn: 16776960, error: 15548997 };

const send = async (title, description, level = 'info') => {
  const cfg = await config.loadDbConfig();
  if (!cfg.discordWebhook) return;
  const alertEnabled = {
    info: true,
    success: cfg.discordAlerts.sales || cfg.discordAlerts.promptEdit,
    warn: true,
    error: cfg.discordAlerts.error
  }[level];
  if (!alertEnabled) return;

  try {
    await axios.post(cfg.discordWebhook, {
      embeds: [{
        title: String(title || '').substring(0, 256),
        description: String(description || '').substring(0, 2000),
        color: COLORS[level] || COLORS.info,
        timestamp: new Date().toISOString(),
        footer: { text: 'CarBot System' }
      }]
    }, { timeout: 10000 });
  } catch (err) {
    console.error('Discord webhook failed:', err.message);
  }
};

module.exports = {
  send,
  newSale: (amount, tierName, phone) =>
    send('✅ Шинэ борлуулалт', `**Дүн:** ${Number(amount).toLocaleString()}₮\n**Түвшин:** ${tierName || '-'}\n**Утас:** ${phone || 'N/A'}`, 'success'),
  paymentMismatch: (phone, expected, got) =>
    send('⚠️ Төлбөр тохирохгүй', `**Утас:** ${phone || 'Олдсонгүй'}\n**Хүлээгдэж байсан:** ${expected ? expected + '₮' : 'N/A'}\n**Ирсэн дүн:** ${got ? got + '₮' : 'N/A'}`, 'warn'),
  systemDown: (err) =>
    send('🚨 СИСТЕМИЙН КРИТИК АЛДАА', String(err || 'Unknown').substring(0, 1900), 'error'),
  kimiReportReady: (summary) =>
    send('🧠 Долоо хоногийн Kimi бизнес тайлан', String(summary).substring(0, 1900), 'info'),
  promptUpdated: (category, tier) =>
    send('✏️ Промпт шинэчлэгдсэн', `**Ангилал:** ${category}\n**Түвшин:** ${tier}\nШинэ утга дараагийн дуудлагаас шууд ашиглагдана.`, 'success'),
  startup: (url) =>
    send('✅ Систем амжилттай асаалаа', `Railway public URL: ${url || 'N/A'}`, 'success'),
  dailyTokenReport: (report) =>
    send('💰 Өдрийн Kimi token зардалын тайлан', report, 'info')
};
