// import { RedisPubSub } from 'graphql-redis-subscriptions';
// import Redis from 'ioredis';

// const url = /*process.env.REDIS_URL || */ 'redis://redis:6379';
// const opts = { lazyConnect: true, maxRetriesPerRequest: null } as const;

// export const pubsub = new RedisPubSub({
//   publisher: new Redis(url, opts),
//   subscriber: new Redis(url, opts),
// });


// packages/realtime/src/pubsub.ts
import { Redis } from 'ioredis';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import type { RedisOptions } from 'ioredis';

const url = /*process.env.REDIS_URL ||*/  'redis://redis:6379';
const opts: RedisOptions = { lazyConnect: true, maxRetriesPerRequest: null };

export const pubsub = new RedisPubSub({
  publisher: new Redis(url, opts),
  subscriber: new Redis(url, opts),
});
