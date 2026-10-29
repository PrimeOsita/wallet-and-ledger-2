const express = require('express');
const auth = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');
const { strict } = require('../middleware/rateLimiter');
const { schemas, validate } = require('../validators/walletValidator');
const ctrl = require('../controllers/walletController');

const router = express.Router();
router.use(auth);

router.post('/', validate(schemas.createWallet), ctrl.createWallet);
router.post('/transfer', strict, validate(schemas.transfer), idempotency, ctrl.transfer);
if (process.env.NODE_ENV !== 'production') {
  router.post('/:id/fund', strict, validate(schemas.fund), idempotency, ctrl.fund);
}
router.patch('/:id', validate(schemas.updateWallet), ctrl.updateWallet);
router.delete('/:id', ctrl.closeWallet);
router.get('/:id', ctrl.getWallet);
router.get('/', ctrl.getWallets);
router.get('/:id/statement', ctrl.getStatement);

module.exports = router;