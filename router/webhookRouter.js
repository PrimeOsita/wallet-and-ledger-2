const express = require('express');
const ctrl = require('../controllers/webhookController');

const router = express.Router();
router.post('/', express.raw({ type: () => true, limit: '1mb' }), ctrl.handle);

module.exports = router;