// apps/web/lib/dev-guards.ts
import { NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/auth/server"; // จากที่เราเคยทำ
// import { verifyInternal } from "@/lib/internal-verify"; // HMAC verify

export function requireAdminOrInternal(req: NextRequest) {
  // server-side cookie check (Next.js server handler)
  const admin = verifyAdminSession();
  if (admin) return { ok: true, actor: admin };

  // หรือถ้ามี internal signature (cron/worker)
  // Note: verifyInternal ต้องการ body text; ตัวอย่างที่ใช้ใน route จะเรียก verifyInternal(req, bodyText)
  return { ok: false, reason: "not admin or internal" };
}
