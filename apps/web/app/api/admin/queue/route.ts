// app/api/admin/queue/route.ts
import { NextResponse } from "next/server";
import { Redis } from "ioredis";
import { Pool, type QueryResult } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRedis() {
  return new Redis(process.env.REDIS_URL ?? "redis://redis:6379");
}

const QUEUE_KEY = process.env.SOCIAL_QUEUE_KEY ?? "social:publish:queue";
const DLQ_KEY = process.env.SOCIAL_DLQ_KEY ?? "social:publish:dlq";
const DELAYED_KEY = process.env.SOCIAL_DELAYED_KEY ?? "social:publish:delayed";

// ✅ pool reuse (สำคัญมาก กัน connect รัว)
const pool: Pool =
  (globalThis as any).__QUEUE_DB_POOL ??
  new Pool({
    host: process.env.POSTGRES_HOST ?? "postgres",
    port: Number(process.env.POSTGRES_PORT ?? "5432"),
    database: process.env.POSTGRES_DB ?? "appdb",
    user: process.env.POSTGRES_USER ?? "app",
    password: process.env.POSTGRES_PASSWORD ?? "app",
  });

(globalThis as any).__QUEUE_DB_POOL = pool;

type AnyObj = Record<string, any>;

function isPlainObject(x: any): x is AnyObj {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

function toStr(x: any) {
  if (typeof x === "string") return x;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

/**
 * parse แบบทนมาก:
 * - JSON.parse 1 รอบ
 * - ถ้าออกมาเป็น string ที่ยังดูเหมือน JSON -> parse ซ้ำ (max 3 รอบ)
 * - คืน object เท่านั้น (ไม่คืน array/string)
 */
function parseDeepObject(raw: any): AnyObj | null {
  try {
    if (raw === null || raw === undefined) return null;

    if (isPlainObject(raw)) return raw;

    let v: any = JSON.parse(toStr(raw).trim());

    for (let i = 0; i < 3; i++) {
      if (typeof v === "string") {
        const t = v.trim();
        if (
          (t.startsWith("{") && t.endsWith("}")) ||
          (t.startsWith("[") && t.endsWith("]"))
        ) {
          v = JSON.parse(t);
          continue;
        }
      }
      break;
    }

    return isPlainObject(v) ? v : null;
  } catch {
    return null;
  }
}

function safeJsonDeep(raw: any) {
  const s = toStr(raw);
  const parsed = parseDeepObject(s);
  return { raw: s, parsed };
}

function pickFields(job: AnyObj | null) {
  const postId = job?.post?.postId ?? job?.postId ?? null;
  return {
    platform: job?.platform ?? null,
    action: job?.action ?? null,
    postId,
    eventId: job?.eventId ?? null,
    attempts: Number(job?.attempts ?? 0),
    maxAttempts: Number(job?.maxAttempts ?? 0),
  };
}

type CountRow = { count: string };

export async function GET() {
  const redis = getRedis();

  // ✅ นับ DB (ถ้าพังให้ยัง ok ได้ แต่บอก warning)
  let dbCount = 0;
  let dbError: string | undefined = undefined;

  try {
    // ✅ แบบนี้ไม่โดน "untyped function calls may not accept type arguments."
    const r: QueryResult<CountRow> = await pool.query(
      `SELECT COUNT(*)::text AS count FROM social_posts`
    );
    dbCount = Number(r.rows?.[0]?.count ?? "0");
  } catch (e: any) {
    dbError = String(e?.message ?? e);
    dbCount = 0;
  }

  const [queueLen, dlqLen, delayedLen] = await Promise.all([
    redis.llen(QUEUE_KEY),
    redis.llen(DLQ_KEY),
    redis.zcard(DELAYED_KEY),
  ]);

  const N = 50;

  const [queueRaw, dlqRaw, delayedRaw] = await Promise.all([
    redis.lrange(QUEUE_KEY, 0, N - 1),
    redis.lrange(DLQ_KEY, 0, N - 1),
    redis.zrange(DELAYED_KEY, 0, N - 1, "WITHSCORES"),
  ]);

  // delayedRaw: [member0, score0, member1, score1, ...]
  const delayedPairs: Array<{ raw: string; runAtMs: number }> = [];
  for (let i = 0; i < delayedRaw.length; i += 2) {
    delayedPairs.push({
      raw: delayedRaw[i],
      runAtMs: Number(delayedRaw[i + 1]),
    });
  }

  // QUEUE: raw = job json
  const queue = queueRaw.map((raw) => {
    const sj = safeJsonDeep(raw);
    const fields = pickFields(sj.parsed);

    return {
      kind: "queue",
      ...fields,
      parsed: sj,
      raw: sj.raw,
    };
  });

  // DELAYED: raw = job json (อาจ stringify ซ้อน)
  const delayed = delayedPairs.map(({ raw, runAtMs }) => {
    const sj = safeJsonDeep(raw);
    const fields = pickFields(sj.parsed);

    return {
      kind: "delayed",
      ...fields,
      runAtMs,
      parsed: sj,
      raw: sj.raw,
    };
  });

  // DLQ: raw = wrapper json: { raw: "<job>", reason, at }
  const dlq = dlqRaw.map((item) => {
    const wrapperObj =
      (typeof item === "string" ? safeJsonDeep(item).parsed : item) ?? null;

    const reason = wrapperObj?.reason ?? null;
    const at = wrapperObj?.at ?? null;

    const jobRaw = typeof wrapperObj?.raw === "string" ? wrapperObj.raw : "";
    const jobObj = jobRaw ? safeJsonDeep(jobRaw).parsed : null;

    const fields = pickFields(jobObj);

    return {
      kind: "dlq",
      ...fields,
      attempts: Number(jobObj?.attempts ?? fields.attempts ?? 0),
      maxAttempts: Number(jobObj?.maxAttempts ?? fields.maxAttempts ?? 0),
      reason,
      at,
      job: jobObj,
      parsed: jobObj,
      rawJob: jobRaw,
      rawWrapper: typeof item === "string" ? item : JSON.stringify(item),
    };
  });

  await redis.quit();

  return NextResponse.json({
    ok: true,
    keys: { QUEUE_KEY, DLQ_KEY, DELAYED_KEY },
    counts: { queueLen, dlqLen, delayedLen, dbCount },
    preview: { queue, delayed, dlq },
    now: Date.now(),
    ...(dbError ? { dbError } : {}),
  });
}
