const config = require('../config/global');

exports.adminAuth = async (req, res, next) => {
  const cfg = await config.loadDbConfig();
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!key || key !== cfg.adminApiKey) return res.status(403).json({ error: 'Forbidden: invalid admin key' });
  // IP whitelist check
  if (cfg.adminAllowedIps.length) {
    const clientIp = req.ip || req.connection.remoteAddress;
    if (!cfg.adminAllowedIps.includes(clientIp)) return res.status(403).json({ error: 'Forbidden: IP not allowed' });
  }
  next();
};
