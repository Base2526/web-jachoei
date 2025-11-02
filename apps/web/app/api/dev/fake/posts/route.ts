// apps/web/app/api/dev/fake/posts/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdminOrInternal } from "@/lib/dev-guards";
import { query } from "@/lib/db"; // สมมติมี helper query(pg)
import { nanoid } from "nanoid"; // optional

export async function POST(req: NextRequest) {
    console.log("[POST] - fake");
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Disabled in production" }, { status: 403 });

    const body = await req.json();
    const { count = 5, randomize = true } = body;

    // basic guard: verify admin cookie (server-side) or internal signature
    const guard = requireAdminOrInternal(req);
    if (!guard.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const created: any[] = [];
    for (let i = 0; i < count; i++) {
        const title = randomize ? `Test Post ${nanoid(6)}` : `Test Post`;
        const phone = `08${Math.floor(10000000 + Math.random() * 90000000)}`;
        const status = Math.random() > 0.5 ? "public" : "unpublic";
        const content = `Fake content ${new Date().toISOString()}`;

        // ตัวอย่าง insert; ปรับชื่อ table/columns ให้ตรงโปรเจกต์ของคุณ
        const sql = `INSERT INTO posts (title, phone, body, status, author_id, meta, created_at, fake_test)
                    VALUES ($1,$2,$3,$4,$5,$6,NOW(), true) RETURNING *`;
        const author_id = guard.actor?.id || null; // ถ้ามี actor (admin) ให้เป็นผู้สร้าง
        const meta = JSON.stringify({ env: process.env.NODE_ENV, generated_by: guard.actor?.id ?? 'internal' });
        const { rows } = await query(sql, [title, phone, content, status, author_id, meta]);
        created.push(rows[0]);
    }

    return NextResponse.json({ ok: true, created });
}
