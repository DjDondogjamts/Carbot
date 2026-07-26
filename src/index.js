require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Ulaanbaatar';

const express = require('express');
const bp = require('body-parser');
const cron = require('node-cron');
const path = require('path');
const rateLimit = require('express-rate-limit');

const db = require('./config/db');
const config = require('./config/global');
const discord = require('./alerts/discord');
const dictionary = require('./knowledge/dictionary');
const metrics = require('./bi/metrics');
const webhook = require('./messenger/webhook');
const payment = require('./payment/khanbank');
const bi = require('./ai/businessAnalyst');

const app = express();
app.use(bp.json({ limit: '50mb' }));
app.use(bp.urlencoded({ extended: true, limit: '50mb' }));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 60000, max: 100 }));
app.use('/api/payment-sms', rateLimit({ windowMs: 60000, max: 30 }));

// Public routes
app.get('/api/webhook', webhook.verify);
app.post('/api/webhook', webhook.handleIncoming);
app.post('/api/payment-sms', payment.handleSMS);

// Admin API routes
app.use('/api/admin/prompts', require('./admin/prompts'));
app.use('/api/admin/system-config', require('./admin/systemConfig'));
app.use('/api/admin/payment', require('./admin/payment'));

// Admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// BI endpoints
app.get('/api/bi/metrics', async (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_API_KEY) return res.status(403).send('Forbidden');
  res.json(await metrics.snapshot());
});
app.get('/api/bi/weekly-report', async (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_API_KEY) return res.status(403).send('Forbidden');
  res.send(await bi.generateWeekly());
});

// Health checks
app.get('/health', async (req, res) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', tz: process.env.TZ }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});
app.get('/', (req, res) => res.send('CarBot v2.0 OK'));

// Scheduled cron jobs
(async () => {
  const cfg = await config.loadDbConfig();
  cron.schedule(cfg.cron.weeklyReport, async () => {
    try { await bi.generateWeekly(); } catch (e) { discord.systemDown('Weekly report failed: ' + e.message); }
  }, { timezone: 'Asia/Ulaanbaatar' });

  cron.schedule(cfg.cron.dictReload, async () => {
    try { await dictionary.load(); } catch (e) { console.warn('Dict reload fail:', e.message); }
  }, { timezone: 'Asia/Ulaanbaatar' });

  cron.schedule(cfg.cron.healthCheck, async () => {
    try { await metrics.updateSystemHealth(); } catch (_) {}
  }, { timezone: 'Asia/Ulaanbaatar' });

  // Daily token cost report at 23:55
  cron.schedule('55 23 * * *', async () => {
    try { await bi.generateDailyTokenReport(); } catch (e) { console.error('Daily report fail:', e.message); }
  }, { timezone: 'Asia/Ulaanbaatar' });
})();

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err);
  discord.systemDown(err.stack || err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED:', reason);
  discord.systemDown(String(reason?.stack || reason));
});

// Startup
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 CarBot v2.0 starting on port ${PORT} (TZ=${process.env.TZ})`);
  try { await dictionary.load(); } catch (e) { console.warn('Dict startup load skipped:', e.message); }
  try { await metrics.updateSystemHealth(); } catch (_) {}
  try { await discord.startup(process.env.RAILWAY_URL || `http://localhost:${PORT}`); } catch (_) {}
  console.log('✅ CarBot v2.0 ready');
});
