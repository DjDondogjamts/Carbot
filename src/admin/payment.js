const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin } = require('./middleware');

router.get('/pending', requireAdmin, async (req, res) => {
  const result = await db.query(`
    SELECT p.id, p.session_id, p.phone, p.amount, s.amount as expected_amount, p.created_at
    FROM payments p
    JOIN sessions s ON p.session_id = s.id
    WHERE p.status = 'pending'
    ORDER BY p.created_at DESC
  `);
  res.json(result.rows);
});

router.post('/:id/approve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  await db.query('UPDATE payments SET status = $1, matched_by = $2 WHERE id = $3', ['approved', 'manual', id]);
  const payment = await db.query('SELECT session_id FROM payments WHERE id = $1', [id]);
  if (payment.rows.length) {
    await db.query('UPDATE sessions SET paid = true WHERE id = $1', [payment.rows[0].session_id]);
  }
  res.json({ success: true });
});

module.exports = router;
