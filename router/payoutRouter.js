const express = require('express');
const auth = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');
const { strict } = require('../middleware/rateLimiter');
const { validatePayout } = require('../validators/payoutValidator');
const ctrl = require('../controllers/payoutController');

const router = express.Router();
router.use(auth);

router.post('/', strict, validatePayout, idempotency, ctrl.requestPayout);
router.get('/:id', ctrl.getPayout);

module.exports = router;