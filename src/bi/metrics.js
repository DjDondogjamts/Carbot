const db = require('../config/db');

exports.snapshot = async () => {
  const q = `
    SELECT 'daily_sales' k, COUNT(*) v FROM payments WHERE status='paid' AND DATE(created_at)=CURRENT_DATE
    UNION ALL SELECT 'weekly_sales', COUNT(*) FROM payments WHERE status='paid' AND created_at>NOW()-INTERVAL '7 days'
    UNION ALL SELECT 'weekly_revenue', COALESCE(SUM(amount),0) FROM payments WHERE status='paid' AND created_at>NOW()-INTERVAL '7 days'
    UNION ALL SELECT 'ai_cost_weekly', COALESCE(SUM(cost_mnt),0) FROM ai_calls WHERE created_at>NOW()-INTERVAL '7 days'
    UNION ALL SELECT 'net_profit_weekly', COALESCE(SUM(amount)-SUM(cost_mnt),0) FROM payments p LEFT JOIN ai_calls a ON a.session_id=p.session_id WHERE p.status='paid' AND p.created_at>NOW()-INTERVAL '7 days'
    UNION ALL SELECT 'avg_rating', COALESCE(ROUND(AVG(rating)::numeric,2),0) FROM feedback WHERE created_at>NOW()-INTERVAL '7 days'
  `;
  const rows = (await db.query(q)).rows;
  const out = {};
  rows.forEach(r => out[r.k] = r.v);
  return out;
};

exports.updateSystemHealth = async () => {
  const checks = [
    { component: 'postgresql', test: async () => { await db.query('SELECT 1'); return 'ok'; } },
    { component: 'kimi_api', test: async () => { return 'ok'; } }
  ];
  for (const c of checks) {
    const s = Date.now();
    let status = 'ok', detail = null;
    try { await c.test(); }
    catch (e) { status = 'error'; detail = e.message; }
    await db.query(
      `INSERT INTO system_health (component, status, latency_ms, details) VALUES ($1,$2,$3,$4)`,
      [c.component, status, Date.now() - s, detail ? { error: detail } : null]
    );
  }
};
