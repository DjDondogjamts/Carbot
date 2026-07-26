const express = require('express');
const router = express.Router();
const db = require('../config/db');
const prompts = require('../config/prompts');
const { requireAdmin } = require('./middleware');

// Get all prompts
router.get('/', requireAdmin, async (req, res) => {
  const result = await db.query('SELECT id, category, tier, prompt_text, updated_at FROM service_prompts ORDER BY category, tier');
  res.json(result.rows);
});

// Get audit logs
router.get('/audit', requireAdmin, async (req, res) => {
  const result = await db.query('SELECT * FROM prompt_audit_logs ORDER BY created_at DESC LIMIT 100');
  res.json(result.rows);
});

// Update prompt
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { prompt_text } = req.body;
  if (!prompt_text || typeof prompt_text !== 'string') return res.status(400).json({ error: 'prompt_text required' });
  
  const old = await db.query('SELECT * FROM service_prompts WHERE id = $1', [id]);
  if (!old.rows.length) return res.status(404).json({ error: 'Prompt not found' });
  
  await db.query('UPDATE service_prompts SET prompt_text = $1, updated_at = NOW() WHERE id = $2', [prompt_text, id]);
  await db.query(
    'INSERT INTO prompt_audit_logs (prompt_id, action, old_value, new_value, admin_user) VALUES ($1, $2, $3, $4, $5)',
    [id, 'UPDATE', old.rows[0].prompt_text, prompt_text, req.ip]
  );
  
  // Clear prompt cache so changes take effect immediately
  prompts.clearCache();
  res.json({ success: true });
});

module.exports = router;
