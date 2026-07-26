const axios = require('axios');
const db = require('../config/db');
const dictionary = require('../knowledge/dictionary');
const config = require('../config/global');
const prompts = require('../config/prompts');

const buildSystemPrompt = async (opts = {}) => {
  const cfg = await config.loadDbConfig();
  // Load editable global base system prompt from DB
  const basePrompt = await prompts.getGlobalBase();
  const lines = [basePrompt];
  
  // Append dictionary terms
  const terms = dictionary.getAll();
  if (terms.length) lines.push(`\n📖 Мэргэжлийн нэр томъёоны толь бичиг (заавал дагаж мөрдөнө): ${JSON.stringify(terms.slice(0, 800))}`);
  if (opts.enableSearch && cfg.zurkhaiEnableWebSearch) {
    lines.push(`\n7. Вэб хайлт хийхдээ зөвхөн gogo.mn, autobox.mn, unegui.mn сайтуудыг ашиглана, бусад сайт бүү ашигла.`);
  }
  return lines.join('\n');
};

exports.call = async (userPrompt, type = 'report', sessionId = null, opts = {}) => {
  const startedAt = Date.now();
  const cfg = await config.loadDbConfig();
  const sys = await buildSystemPrompt(opts);
  const model = opts.largeModel ? cfg.kimiLargeModel : cfg.kimiDefaultModel;
  const maxTokens = opts.maxTokens || 4000;

  const body = {
    model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: String(userPrompt) }
    ],
    temperature: opts.temperature ?? 0.2,
    max_tokens: maxTokens
  };
  if (opts.enableSearch && cfg.zurkhaiEnableWebSearch) {
    body.tools = [{
      type: 'web_search',
      web_search: { search_result_count: 3, user_location: { type: 'geo', country: 'MN', city: 'Ulaanbaatar' } }
    }];
  }

  const resp = await axios.post(`${cfg.kimiBaseUrl}/chat/completions`, body, {
    headers: { Authorization: `Bearer ${cfg.kimiApiKey}` },
    timeout: cfg.kimiTimeoutMs
  });

  const msg = resp.data.choices[0].message;
  const tokens = resp.data.usage.total_tokens;
  const costMnt = (tokens / 1_000_000) * cfg.kimiCostPerMTokens;
  const content = msg.content || '';
  const dictUsed = terms.length && terms.some(t => t.mn && content.includes(t.mn.replace(/\*\*/g, '')));
  const webUsed = Array.isArray(msg.tool_calls) && msg.tool_calls.some(c => c.type === 'web_search');

  await db.query(
    `INSERT INTO ai_calls (session_id, type, model, tokens_used, cost_mnt, response_time_ms, dictionary_used, web_search_used)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [sessionId, type, model, tokens, costMnt, Date.now() - startedAt, dictUsed, webUsed]
  );

  return content;
};
