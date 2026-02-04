// packages/social-queue/queue.server.ts
import { Redis } from "ioredis";
import type { SocialJob } from "./types";

const DEFAULT_REDIS_URL = "redis://redis:6379";

/* -------------------------------------------------- */
/* utils */
/* -------------------------------------------------- */

function env(key: string, def: string) {
  const v = process.env[key];
  return v && v.trim() !== "" ? v : def;
}

// const DEBUG = process.env.SOCIAL_QUEUE_DEBUG === "1";

const DEBUG = "1";

function log(...args: any[]) {
  if (DEBUG) {
    console.error("[social-queue]", ...args);
  }
}

function shortJob(job: any) {
  return {
    platform: job?.platform,
    action: job?.action,
    postId: job?.post?.postId,
    eventId: job?.eventId,
    attempts: job?.attempts,
  };
}

/* -------------------------------------------------- */
/* keys */
/* -------------------------------------------------- */

export const QUEUE_KEY   = env("SOCIAL_QUEUE_KEY",   "social:publish:queue");
export const DLQ_KEY     = env("SOCIAL_DLQ_KEY",     "social:publish:dlq");
export const DELAYED_KEY = env("SOCIAL_DELAYED_KEY", "social:publish:delayed");

/* -------------------------------------------------- */
/* redis */
/* -------------------------------------------------- */

export function createRedis(): Redis {
  const url = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;

  const redis = new Redis(url);

  if (DEBUG) {
    redis.on("connect", () => {
      log("redis connect", { url });
    });

    redis.on("ready", () => {
      log("redis ready");
    });

    redis.on("error", (err) => {
      log("redis error", err?.message ?? err);
    });

    redis.on("close", () => {
      log("redis close");
    });
  }

  return redis;
}

export async function ensureRedis(redis: Redis) {
  const pong = await redis.ping();
  log("redis ping =", pong);
}

/* -------------------------------------------------- */
/* queue ops */
/* -------------------------------------------------- */

export async function enqueueSocialJob(redis: Redis, job: SocialJob) {
  const raw = JSON.stringify(job);

  log("enqueue BEGIN", {
    key: QUEUE_KEY,
    job: shortJob(job),
  });

  const before = DEBUG ? await redis.llen(QUEUE_KEY) : null;

  const res = await redis.lpush(QUEUE_KEY, raw);

  const after = DEBUG ? await redis.llen(QUEUE_KEY) : null;

  log("enqueue DONE", {
    key: QUEUE_KEY,
    result: res,
    lenBefore: before,
    lenAfter: after,
  });

  return res;
}

export async function brpopSocialJob(redis: Redis, timeoutSeconds = 30) {
  log("brpop WAIT", { key: QUEUE_KEY, timeoutSeconds });

  const res = await redis.brpop(QUEUE_KEY, timeoutSeconds);
  if (!res) {
    log("brpop TIMEOUT");
    return null;
  }

  const [, raw] = res;

  log("brpop GOT", {
    key: QUEUE_KEY,
    rawPreview: raw?.slice(0, 120),
  });

  return raw;
}

/* -------------------------------------------------- */
/* DLQ */
/* -------------------------------------------------- */

export async function pushDLQ(redis: Redis, raw: string, reason: string) {
  log("DLQ PUSH BEGIN", {
    key: DLQ_KEY,
    reason,
    rawPreview: raw?.slice(0, 120),
  });

  const before = DEBUG ? await redis.llen(DLQ_KEY) : null;

  const res = await redis.lpush(
    DLQ_KEY,
    JSON.stringify({
      raw,
      reason,
      at: new Date().toISOString(),
    })
  );

  const after = DEBUG ? await redis.llen(DLQ_KEY) : null;

  log("DLQ PUSH DONE", {
    key: DLQ_KEY,
    result: res,
    lenBefore: before,
    lenAfter: after,
  });

  return res;
}

/* -------------------------------------------------- */
/* delayed / retry */
/* -------------------------------------------------- */

export async function scheduleRetry(redis: Redis, raw: string, runAtMs: number) {
  log("RETRY SCHEDULE BEGIN", {
    key: DELAYED_KEY,
    runAt: new Date(runAtMs).toISOString(),
    rawPreview: raw?.slice(0, 120),
  });

  const before = DEBUG ? await redis.zcard(DELAYED_KEY) : null;

  const res = await redis.zadd(DELAYED_KEY, String(runAtMs), raw);

  const after = DEBUG ? await redis.zcard(DELAYED_KEY) : null;

  log("RETRY SCHEDULE DONE", {
    key: DELAYED_KEY,
    result: res,
    sizeBefore: before,
    sizeAfter: after,
  });

  return res;
}

export async function pumpDelayed(redis: Redis, batch = 50) {
  const now = Date.now();

  log("pumpDelayed BEGIN", {
    key: DELAYED_KEY,
    now: new Date(now).toISOString(),
    batch,
  });

  const raws = await redis.zrangebyscore(
    DELAYED_KEY,
    0,
    now,
    "LIMIT",
    0,
    batch
  );

  if (raws.length === 0) {
    log("pumpDelayed EMPTY");
    return 0;
  }

  const beforeQueue = DEBUG ? await redis.llen(QUEUE_KEY) : null;
  const beforeDelayed = DEBUG ? await redis.zcard(DELAYED_KEY) : null;

  await redis.zrem(DELAYED_KEY, ...raws);
  await redis.rpush(QUEUE_KEY, ...raws);

  const afterQueue = DEBUG ? await redis.llen(QUEUE_KEY) : null;
  const afterDelayed = DEBUG ? await redis.zcard(DELAYED_KEY) : null;

  log("pumpDelayed DONE", {
    moved: raws.length,
    queue: { before: beforeQueue, after: afterQueue },
    delayed: { before: beforeDelayed, after: afterDelayed },
  });

  return raws.length;
}
