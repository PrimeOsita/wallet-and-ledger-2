const Joi = require('joi');
const { AppError } = require('../middleware/errorhandler');

const objectId = Joi.string().hex().length(24);

const schemas = {
  createWallet: Joi.object({
    currency: Joi.string().length(3).uppercase().required()
  }),
  transfer: Joi.object({
    fromWalletId: objectId.required(),
    toWalletId: objectId.required(),
    amountMinor: Joi.number().integer().min(1).required(),
    description: Joi.string().max(200).allow('')
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