// apps/web/app/api/dev/fake/posts/route.ts
import { NextResponse, NextRequest } from "next/server";
import { requireAdminOrInternal } from "@/lib/dev-guards";
import { query } from "@/lib/db";
import { nanoid } from "nanoid";
import { persistWebFile } from "@/lib/storage"; // <- ใช้ตัวเดียวกับ /api/files
// ^ ปรับ path import ให้ตรงโปรเจ็กต์จริง

export async function POST(req: NextRequest) {
  console.log("[POST] - fake with images");
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }

  // guard
  const guard = requireAdminOrInternal(req);
  console.log("[guard]", guard);
  if (!guard.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ตรวจ content-type เพื่อตัดสินใจ parse
  const contentType = req.headers.get("content-type") || "";

  let count = 5;
  let randomize = true;
  let images: File[] = [];            // จะเก็บไฟล์จาก multipart
  let titleFromForm: string | null = null;
  let phoneFromForm: string | null = null;
  let statusFromForm: "public" | "unpublic" | null = null;

  if (contentType.includes("multipart/form-data")) {
    // รับ form-data + files
    const form = await req.formData();

    // รับ images[] หลายไฟล์
    const imgFields = form.getAll("images");
    for (const it of imgFields) {
      if (it instanceof File) images.push(it);
    }

    // รับฟิลด์อื่น ๆ (ออปชัน)
    const _count = form.get("count");
    const _randomize = form.get("randomize");
    count = _count ? Number(_count) : count;
    randomize = _randomize ? String(_randomize) !== "false" : randomize;

    titleFromForm  = (form.get("title")  as string) || null;
    phoneFromForm  = (form.get("phone")  as string) || null;
    statusFromForm = (form.get("status") as "public" | "unpublic") || null;
  } else {
    // รับ JSON แบบเดิม
    const body = await req.json().catch(() => ({}));
    count     = body?.count      ?? 5;
    randomize = body?.randomize  ?? true;
    // รองรับ images base64? -> ข้าม เพราะคุณจะส่ง File จริงจาก canvas ผ่าน formdata อยู่แล้ว
  }

  const created: any[] = [];

  for (let i = 0; i < count; i++) {
    const title  = titleFromForm  ?? (randomize ? `Test Post ${nanoid(6)}` : `Test Post`);
    const phone  = phoneFromForm  ?? `08${Math.floor(10000000 + Math.random() * 90000000)}`;
    const status = statusFromForm ?? (Math.random() > 0.5 ? "public" : "unpublic");
    const content = `Fake content ${new Date().toISOString()}`;

    // 1) สร้าง post
    const sql = `
      INSERT INTO posts (title, phone, body, status, author_id, meta, created_at, fake_test)
      VALUES ($1,$2,$3,$4,$5,$6,NOW(), true)
      RETURNING *`;
    const author_id = guard.actor?.id || null;
    const meta = JSON.stringify({ env: process.env.NODE_ENV, generated_by: guard.actor?.id ?? "internal" });
    const { rows } = await query(sql, [title, phone, content, status, author_id, meta]);
    const post = rows[0];
    const postId = post.id; // NOTE: posts.id ควรเป็น UUID ให้ตรง schema

    // 2) ถ้ามีรูปภาพแนบมา -> เซฟไฟล์ + ผูก post_images
    if (images.length) {
      const fileRows = [];
      for (const f of images) {
        // persistWebFile: รองรับ File (Web) -> สร้าง row ใน files (และบันทึกลงดิสก์/สตอเรจ)
        const row = await persistWebFile(f);
        fileRows.push(row);
      }
      if (fileRows.length) {
        // สร้าง placeholders ($1, $2, $3, ...) เป็น (post_id, file_id)
        const values = fileRows.map((_, i) => `($1, $${i + 2})`).join(", ");
        await query(
          `INSERT INTO post_images (post_id, file_id) VALUES ${values}`,
          [postId, ...fileRows.map(r => r.id)]
        );
      }
    }

    created.push(post);
  }

  return NextResponse.json({ ok: true, created });
}
