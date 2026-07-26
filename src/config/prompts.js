const db = require('./db');
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds cache, auto refresh

async function loadAll(force = false) {
  if (cache && !force && Date.now() - cacheTime < CACHE_TTL) return cache;
  const res = await db.query('SELECT category, tier, prompt_text FROM service_prompts');
  cache = {};
  for (const row of res.rows) {
    const key = `${row.category}_${row.tier}`;
    cache[key] = row.prompt_text;
  }
  cacheTime = Date.now();
  return cache;
}

function clearCache() {
  cache = null;
  cacheTime = 0;
}

async function get(category, tier, replacements = {}) {
  const prompts = await loadAll();
  const key = `${category}_${tier}`;
  let text = prompts[key] || '';
  // Template replacement
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v ?? ''));
  }
  return text;
}

async function getGlobalBase() {
  return get('global', 'base');
}

async function getAll() {
  return loadAll();
}

module.exports = { get, getGlobalBase, getAll, clearCache, loadAll };
