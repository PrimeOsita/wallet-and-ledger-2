const express = require('express');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('../../../../docs/swagger');
const { general } = require('../../../../middleware/rateLimiter');
const { notFound, errorHandler } = require('../../../../middleware/errorhandler');
const walletRouter = require('../../../../router/walletRouter');
const payoutRouter = require('../../../../router/payoutRouter');
const webhookRouter = require('../../../../router/webhookRouter');

const app = express();

app.use(helmet());
app.use('/api/webhooks', webhookRouter); // raw body, must come before express.json()
app.use(express.json({ limit: '100kb' }));
app.use(general);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/wallets', walletRouter);
app.use('/api/payouts', payoutRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;