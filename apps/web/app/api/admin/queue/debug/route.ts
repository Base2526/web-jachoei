import { NextResponse } from "next/server";
import { Redis } from "ioredis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUEUE_KEY =
  process.env.SOCIAL_QUEUE_KEY && process.env.SOCIAL_QUEUE_KEY.trim() !== ""
    ? process.env.SOCIAL_QUEUE_KEY
    : "social:publish:queue";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const postId = url.searchParams.get("postId"); // ต้องเป็น UUID ที่มีในตาราง posts
  const platform = url.searchParams.get("platform") ?? "facebook";

  if (!postId) {
    return NextResponse.json(
      { ok: false, error: "missing postId. Use /api/admin/queue/debug?postId=<uuid>" },
      { status: 400 }
    );
  }

  const redis = new Redis(process.env.REDIS_URL ?? "redis://redis:6379");

  try {
    const ping = await redis.ping();

    const job = {
      platform,
      action: "create",
      eventId: "debug-" + Date.now(),
      post: { postId, title: "debug title", summary: "debug summary" },
      attempts: 0,
      maxAttempts: 3
    };

    await redis.lpush(QUEUE_KEY, JSON.stringify(job));

    // NOTE: ถ้า worker รันอยู่ มันอาจ BRPOP ไปทันที ทำให้ len เป็น 0 ได้
    // เราเลยคืนค่า “queue snapshot” ให้ดูด้วย (รวม DLQ)
    const [len, head, dlqLen] = await Promise.all([
      redis.llen(QUEUE_KEY),
      redis.lrange(QUEUE_KEY, 0, 2),
      redis.llen(process.env.SOCIAL_DLQ_KEY ?? "social:publish:dlq")
    ]);

    return NextResponse.json({
      ok: true,
      ping,
      redisUrl: process.env.REDIS_URL ?? "(default)",
      queueKey: QUEUE_KEY,
      pushed: { postId, platform },
      queueLenNow: len,
      queueHead: head,
      dlqLenNow: dlqLen
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  } finally {
    await redis.quit();
  }
}
