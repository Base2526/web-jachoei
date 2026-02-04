// apps/web/app/api/dev/fake/cleanup/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdminOrInternal } from "@/lib/dev-guards";
import { query } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  const guard = requireAdminOrInternal(req);
  if (!guard.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ตัวอย่างลบเฉพาะ rows ที่เราแทรกด้วย fake_test = true
  const resPosts = await query('DELETE FROM posts WHERE fake_test = true RETURNING id');
  const resUsers = await query('DELETE FROM users WHERE fake_test = true RETURNING id');

  return NextResponse.json({ ok: true, deleted: (resPosts.rows.length + resUsers.rows.length), posts: resPosts.rows.length, users: resUsers.rows.length });
}
