const Redis = require('ioredis');

// BullMQ requires maxRetriesPerRequest to be null
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null
});

redis.on('error', (err) => console.error('Redis error:', err.message));

module.exports = redis;