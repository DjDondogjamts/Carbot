const express = require('express');
const router = express.Router();
const payment = require('../payment/khanbank');
const { adminAuth } = require('./middleware');

router.use(adminAuth);

router.post('/manual-approve/:sessionId', async (req, res) => {
  try {
    await payment.manualApprove(parseInt(req.params.sessionId), req.body.reason || 'Admin manual approval');
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
