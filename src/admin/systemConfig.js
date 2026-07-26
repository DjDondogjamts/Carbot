const express = require('express');
const router = express.Router();
const db = require('../config/db');
const config = require('../config/global');
const { adminAuth } = require('./middleware');

router.use(adminAuth);

router.get('/', async (req, res) => {
  const rows = (await db.query(`SELECT * FROM system_config ORDER BY key`)).rows;
  res.json(rows);
});

router.post('/:key', async (req, res) => {
  const { key } = req.params;
  const { value, data_type = 'string', description = '' } = req.body;
  await db.query(
    `INSERT INTO system_config (key, value, data_type, description) VALUES ($1,$2,$3,$4)
     ON CONFLICT (key) DO UPDATE SET value=$2, data_type=$3, description=$4, updated_at=CURRENT_TIMESTAMP`,
    [key, String(value), data_type, description]
  );
  config.clearCache();
  res.json({ success: true });
});

router.delete('/:key', async (req, res) => {
  await db.query(`DELETE FROM system_config WHERE key=$1`, [req.params.key]);
  config.clearCache();
  res.json({ success: true });
});

// Service tiers management
router.get('/tiers', async (req, res) => {
  const rows = (await db.query(`SELECT * FROM service_tiers ORDER BY tier`)).rows;
  res.json(rows);
});

router.post('/tiers/:tier', async (req, res) => {
  const { tier } = req.params;
  const { tier_name, price, max_tokens, max_images, enable_zurkhai, enable_7step_service, description } = req.body;
  await db.query(
    `INSERT INTO service_tiers (tier, tier_name, price, max_tokens, max_images, enable_zurkhai, enable_7step_service, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (tier) DO UPDATE SET
       tier_name=$2, price=$3, max_tokens=$4, max_images=$5,
       enable_zurkhai=$6, enable_7step_service=$7, description=$8, updated_at=CURRENT_TIMESTAMP`,
    [tier, tier_name, price, max_tokens, max_images, enable_zurkhai, enable_7step_service, description]
  );
  config.clearCache();
  res.json({ success: true });
});

module.exports = router;
