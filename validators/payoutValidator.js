const Joi = require('joi');
const { validate } = require('./walletValidator');

const payoutSchema = Joi.object({
  walletId: Joi.string().hex().length(24).required(),
  amountMinor: Joi.number().integer().min(1).required(),
  destination: Joi.object({
    bankCode: Joi.string().required(),
    accountNumber: Joi.string().required(),
    accountName: Joi.string().required()
  }).required()
});

module.exports = { payoutSchema, validatePayout: validate(payoutSchema) };