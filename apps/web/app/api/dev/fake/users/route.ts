// apps/web/app/api/dev/fake/users/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdminOrInternal } from "@/lib/dev-guards";
import { query } from "@/lib/db";
import { nanoid } from "nanoid";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Disabled in production" }, { status: 403 });

  const body = await req.json();
  const { count = 3 } = body;

  const guard = requireAdminOrInternal(req);
  if (!guard.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const created: any[] = [];
  for (let i = 0; i < count; i++) {
    const name = `Test User ${nanoid(5)}`;
    const email = `test+${nanoid(5)}@example.test`;
    const phone = `08${Math.floor(10000000 + Math.random() * 90000000)}`;
    const role = "Subscriber";
    // Create password_hash same as backend expectation (SHA-256 example)
    const pwd = "password123";
    const password_hash = crypto.createHash('sha256').update(pwd).digest('hex');

    const sql = `INSERT INTO users (name, email, phone, role, password_hash, meta, fake_test, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6, true, NOW()) RETURNING *`;
    const meta = JSON.stringify({ generated_by: guard.actor?.id ?? "internal", env: process.env.NODE_ENV });
    const { rows } = await query(sql, [name, email, phone, role, password_hash, meta]);
    created.push(rows[0]);
  }

  return NextResponse.json({ ok: true, created });
}
