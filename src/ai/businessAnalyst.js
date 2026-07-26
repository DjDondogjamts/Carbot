const db = require('../config/db');
const kimi = require('./kimi');
const discord = require('../alerts/discord');
const config = require('../config/global');

exports.generateWeekly = async () => {
  const metrics = await db.query(`
    SELECT 'revenue_total' k, COALESCE(SUM(amount),0) v FROM payments WHERE status='paid' AND created_at>NOW()-INTERVAL '7 days'
    UNION ALL SELECT 'sales_count', COUNT(*) FROM payments WHERE status='paid' AND created_at>NOW()-INTERVAL '7 days'
    UNION ALL SELECT 'avg_order_value', COALESCE(ROUND(AVG(amount)),0) FROM payments WHERE status='paid' AND created_at>NOW()-INTERVAL '7 days'
    UNION ALL SELECT 'ai_cost_total', COALESCE(SUM(cost_mnt),0) FROM ai_calls WHERE created_at>NOW()-INTERVAL '7 days'
    UNION ALL SELECT 'net_profit', COALESCE(SUM(amount)-SUM(cost_mnt)-150*COUNT(*),0) FROM payments p LEFT JOIN ai_calls a ON a.session_id=p.session_id WHERE p.status='paid' AND p.created_at>NOW()-INTERVAL '7 days'
    UNION ALL SELECT 'avg_rating', COALESCE(ROUND(AVG(rating)::numeric,2),0) FROM feedback WHERE created_at>NOW()-INTERVAL '7 days'
    UNION ALL SELECT 'conversion_pct', COALESCE(ROUND(AVG(CASE WHEN paid THEN 1.0 ELSE 0 END)*100),1) FROM sessions WHERE created_at>NOW()-INTERVAL '7 days'
  `);
  const dataBlock = metrics.rows.map(r => `- ${r.k}: ${r.v}`).join('\n');
  const prompt = `Та CarBot-ын бизнес аналитик. 7 хоногийн өгөгдлөөр тайлан гаргана. Монгол хэлээр, цэгцэл:
1. Хураангуй
2. 3 гол амжилт
3. 3 гол асуудал, шийдэх арга
4. Дараа 7 хоногийн зорилго
5. Орлого, зардал, цэвэр ашгийн шинжилгээ
6. Сайжруулах санал

ӨГӨГДӨЛ:
${dataBlock}`;
  const report = await kimi.call(prompt, 'business_analyst', null, { temperature: 0.2, maxTokens: 4000 });
  await db.query(`INSERT INTO kimi_business_reports (report_text, period, metrics_json) VALUES ($1,'last_7_days',$2)`, [report, JSON.stringify(metrics.rows)]);
  await discord.kimiReportReady(report.substring(0, 1800));
  return report;
};

exports.generateDailyTokenReport = async () => {
  const cfg = await config.loadDbConfig();
  if (!cfg.discordAlerts.dailyReport) return;
  const res = await db.query(`
    SELECT
      COUNT(*) total_calls,
      COALESCE(SUM(tokens_used),0) total_tokens,
      COALESCE(SUM(cost_mnt),0) total_cost_mnt,
      COALESCE(SUM(p.amount),0) total_revenue
    FROM ai_calls a
    LEFT JOIN payments p ON p.session_id = a.session_id AND p.status='paid' AND DATE(p.created_at)=CURRENT_DATE
    WHERE DATE(a.created_at)=CURRENT_DATE
  `);
  const d = res.rows[0];
  const profit = Number(d.total_revenue) - Number(d.total_cost_mnt);
  const msg = `📊 Өдрийн үр дүн:
- Нийт AI дуудлага: ${d.total_calls}
- Зарцуулсан токен: ${Number(d.total_tokens).toLocaleString()}
- Нийт AI зардал: ${Number(d.total_cost_mnt).toLocaleString()}₮
- Орлого: ${Number(d.total_revenue).toLocaleString()}₮
- Цэвэр ашиг (AI зардлыг хассан): ${profit.toLocaleString()}₮
- Ашигт ажиллагаа: ${profit > 0 ? '✅ Ашигтай' : '⚠️ Алдагдалтай'}`;
  await discord.dailyTokenReport(msg);
  return msg;
};
