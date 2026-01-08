import { Redis } from "ioredis";
import { RedisPubSub } from "graphql-redis-subscriptions";
import type { RedisOptions } from "ioredis";

const DEFAULT_REDIS_URL = "redis://redis:6379";

export function getRedisOptions(): RedisOptions {
  return {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

export function createRedisClient() {
  return new Redis(process.env.REDIS_URL ?? DEFAULT_REDIS_URL, getRedisOptions());
}

export const redisPubSub = new RedisPubSub({
  publisher: createRedisClient(),
  subscriber: createRedisClient()
});
