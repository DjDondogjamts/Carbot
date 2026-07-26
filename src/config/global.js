// Global configuration - DB config overrides env vars
const db = require('./db');
const cache = { data: {}, ts: 0 };
const CACHE_TTL = 60000;

const DEFAULTS = {
  port: parseInt(process.env.PORT || '3000'),
  railwayUrl: process.env.RAILWAY_URL || `http://localhost:${process.env.PORT || 3000}`,
  adminApiKey: process.env.ADMIN_API_KEY || '',
  adminAllowedIps: (process.env.ADMIN_ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean),
  smsForwardSecret: process.env.SMS_FORWARD_SECRET || '',
  paymentTolerance: parseInt(process.env.PAYMENT_AMOUNT_TOLERANCE || '500'),
  sessionValidHours: parseInt(process.env.SESSION_VALID_HOURS || '24'),
  fbPageToken: process.env.FB_PAGE_ACCESS_TOKEN || '',
  fbVerifyToken: process.env.FB_VERIFY_TOKEN || '',
  kimiApiKey: process.env.KIMI_API_KEY || '',
  kimiBaseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
  kimiDefaultModel: process.env.KIMI_DEFAULT_MODEL || 'moonshot-v1-8k',
  kimiLargeModel: process.env.KIMI_LARGE_MODEL || 'moonshot-v1-32k',
  kimiTimeoutMs: parseInt(process.env.KIMI_TIMEOUT_MS || '120000'),
  kimiCostPerMTokens: parseFloat(process.env.KIMI_COST_PER_MTOKENS || '15'),
  zurkhaiEnableWebSearch: process.env.ZURKHAI_ENABLE_WEB_SEARCH === 'true',
  googleSaBase64: process.env.GOOGLE_SERVICE_ACCOUNT_BASE64 || '',
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  discordWebhook: process.env.DISCORD_WEBHOOK_URL || '',
  discordAlerts: {
    sales: process.env.DISCORD_ALERT_SALES !== 'false',
    error: process.env.DISCORD_ALERT_ERROR !== 'false',
    promptEdit: process.env.DISCORD_ALERT_PROMPT_EDIT !== 'false',
    dailyReport: process.env.DISCORD_ALERT_DAILY_REPORT !== 'false'
  },
  toyotaSteps: {
    greeting: process.env.TOYOTA_STEP1_GREETING !== 'false',
    docReminder: process.env.TOYOTA_STEP2_DOC_REMINDER !== 'false',
    activeListen: process.env.TOYOTA_STEP3_ACTIVE_LISTEN !== 'false',
    carCareRemind: process.env.TOYOTA_STEP4_CAR_CARE_REMIND !== 'false',
    qualityCheck: process.env.TOYOTA_STEP5_QUALITY_CHECK !== 'false',
    explainDetails: process.env.TOYOTA_STEP6_EXPLAIN_DETAILS !== 'false',
    followup: process.env.TOYOTA_STEP7_7DAY_FOLLOWUP !== 'false'
  },
  cron: {
    weeklyReport: process.env.WEEKLY_REPORT_CRON || '0 9 * * 1',
    dictReload: process.env.DICT_RELOAD_CRON || '0 3 * * *',
    healthCheck: process.env.HEALTH_CHECK_CRON || '*/15 * * * *'
  },
  followUpDays: parseInt(process.env.FOLLOW_UP_DAYS || '7')
};

const loadDbConfig = async () => {
  if (cache.ts && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  try {
    const res = await db.query('SELECT key, value, data_type FROM system_config');
    const dbConfig = {};
    for (const row of res.rows) {
      let val = row.value;
      if (row.data_type === 'number') val = parseFloat(val);
      if (row.data_type === 'boolean') val = val === 'true';
      if (row.data_type === 'json') val = JSON.parse(val);
      dbConfig[row.key] = val;
    }
    cache.data = { ...DEFAULTS, ...dbConfig };
    cache.ts = Date.now();
  } catch (e) {
    cache.data = DEFAULTS;
  }
  return cache.data;
};

const getTierConfig = async (tier) => {
  const config = await loadDbConfig();
  const res = await db.query('SELECT * FROM service_tiers WHERE tier = $1', [tier]);
  return res.rows[0] || {
    tier,
    tier_name: 'Стандарт',
    price: 4900,
    max_tokens: 4000,
    max_images: 5,
    enable_zurkhai: false,
    enable_7step_service: true
  };
};

module.exports = { loadDbConfig, getTierConfig, clearCache: () => { cache.ts = 0; } };
