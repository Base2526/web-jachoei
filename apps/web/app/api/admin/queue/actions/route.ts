// apps/web/app/api/admin/queue/actions/route.ts
import { NextResponse } from "next/server";
import { Redis } from "ioredis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireAdmin(req: Request) {
  const token = req.headers.get("x-admin-token");
  const expected = process.env.ADMIN_TOKEN;
  if (expected && token !== expected) throw new Error("unauthorized");
}

function getRedis() {
  return new Redis(process.env.REDIS_URL ?? "redis://redis:6379");
}

const QUEUE_KEY = process.env.SOCIAL_QUEUE_KEY ?? "social:publish:queue";
const DLQ_KEY = process.env.SOCIAL_DLQ_KEY ?? "social:publish:dlq";
const DELAYED_KEY = process.env.SOCIAL_DELAYED_KEY ?? "social:publish:delayed";

export async function POST(req: Request) {
  try {
    requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    const redis = getRedis();

    if (action === "requeue_dlq") {
      const count = Number(body?.count ?? 50);
      // pop from DLQ head แล้ว push ไปท้าย queue
      let moved = 0;
      for (let i = 0; i < count; i++) {
        const raw = await redis.rpop(DLQ_KEY);
        if (!raw) break;
        await redis.rpush(QUEUE_KEY, raw);
        moved++;
      }
      await redis.quit();
      return NextResponse.json({ ok: true, moved });
    }

    if (action === "clear_queue") {
      await redis.del(QUEUE_KEY);
      await redis.quit();
      return NextResponse.json({ ok: true });
    }

    if (action === "clear_dlq") {
      await redis.del(DLQ_KEY);
      await redis.quit();
      return NextResponse.json({ ok: true });
    }

    if (action === "clear_delayed") {
      await redis.del(DELAYED_KEY);
      await redis.quit();
      return NextResponse.json({ ok: true });
    }

    if (action === "pump_delayed") {
      // ย้าย delayed ที่ถึงเวลา -> queue
      const batch = Number(body?.batch ?? 200);
      const now = Date.now();
      const raws = await redis.zrangebyscore(DELAYED_KEY, 0, now, "LIMIT", 0, batch);
      if (raws.length > 0) {
        await redis.zrem(DELAYED_KEY, ...raws);
        await redis.rpush(QUEUE_KEY, ...raws);
      }
      await redis.quit();
      return NextResponse.json({ ok: true, moved: raws.length });
    }

    await redis.quit();
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const status = msg === "unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
