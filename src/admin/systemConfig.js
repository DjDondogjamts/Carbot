const express = require('express');
const router = express.Router();
const db = require('../config/db');
const config = require('../config/global');
const { requireAdmin } = require('./middleware');

router.get('/', requireAdmin, async (req, res) => {
  try {
    const cfg = await config.loadDbConfig();
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', requireAdmin, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await db.query(
        'INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
        [key, String(value)]
      );
    }
    config.clearCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
