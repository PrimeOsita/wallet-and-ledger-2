const jwt = require('jsonwebtoken');
const { AppError } = require('./errorhandler');

function auth(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'Missing bearer token'));
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}

module.exports = auth;