const Joi = require('joi');
const { AppError } = require('../middleware/errorhandler');
const { SUPPORTED_CURRENCIES } = require('../utils/currencies');
const objectId = Joi.string().hex().length(24);

const schemas = {
  createWallet: Joi.object({
    currency: Joi.string().trim().uppercase().valid(...SUPPORTED_CURRENCIES).required().messages({
      'any.only': `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
      'string.empty': 'Currency is required',
      'string.base': 'Currency must be a string',
      'string.uppercase': 'Currency must be uppercase',
      'string.length': 'Currency must be 3 characters long',
      'any.required': 'Currency is required'
    })
  }),
  transfer: Joi.object({
    fromWalletId: objectId.required(),
    toWalletId: objectId.required(),
    amountMinor: Joi.number().integer().min(1).required(),
    description: Joi.string().max(200).allow('')
  }),
  fund: Joi.object({
    amountMinor: Joi.number().integer().min(1).max(100000000).required()
  })
};

function validate(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return next(new AppError(400, error.details.map((d) => d.message).join('; ')));
    }
    req.body = value;
    next();
  };

}

module.exports = { schemas, validate };