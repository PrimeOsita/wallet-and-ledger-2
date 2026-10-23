class AppError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message;

  if (err.name === 'ValidationError') status = 400;
  if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  }
  if (err.code === 11000) {
    status = 409;
    message = 'Duplicate record';
  }
  if (status >= 500) {
    console.error(err);
    message = 'Internal server error';
  }

  res.status(status).json({
    error: { message, code: typeof err.code === 'string' ? err.code : undefined }
  });
}

module.exports = { AppError, asyncHandler, notFound, errorHandler };