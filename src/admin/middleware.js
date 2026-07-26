const config = require('../config/global');

async function requireAdmin(req, res, next) {
  const cfg = await config.loadDbConfig();
  const key = req.header('X-Admin-Key') || req.query.key;
  if (key !== cfg.adminApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { requireAdmin };
