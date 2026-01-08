import { NextResponse } from "next/server";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { emitPostEvent } from "@events/emit.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUEUE_KEY = process.env.SOCIAL_QUEUE_KEY ?? "social:publish:queue";

export async function GET() {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://redis:6379");

  try {
    const before = await redis.llen(QUEUE_KEY);

    await emitPostEvent("post.created", {
      postId: "emit-test-post",
      actorId: "system",
      title: "Emit Test",
      summary: "Emit Test Summary",
      url: undefined,
      revisionId: "rev",
      eventId: randomUUID(),
      occurredAt: new Date().toISOString()
    });

    // รอให้ listener async ทำ enqueue
    await new Promise((r) => setTimeout(r, 200));

    const after = await redis.llen(QUEUE_KEY);
    const head = await redis.lrange(QUEUE_KEY, 0, 2);

    return NextResponse.json({ ok: true, before, after, head, queueKey: QUEUE_KEY });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  } finally {
    await redis.quit();
  }
}
