// Simple admin auth, no dependencies to avoid circular import errors
function requireAdmin(req, res, next) {
  const providedKey = req.header('X-Admin-Key') || req.query.key;
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { requireAdmin };
