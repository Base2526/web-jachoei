// apps/web/app/api/dev/fake/posts/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdminOrInternal } from "@/lib/dev-guards";
import { query } from "@/lib/db";
import { nanoid } from "nanoid";
import sharp from "sharp"; // <== ติดตั้ง: npm i sharp
import { persistWebFile } from "@/lib/storage"; // <- โมดูลเดียวกับ /api/files

// สร้าง Buffer เป็นรูปภาพ PNG หรือ JPG พื้นสีแบบสุ่ม
async function createRandomImageBuffer(
  w = 800,
  h = 500,
  fmt: "png" | "jpeg" = "png"
): Promise<Buffer> {
  const bg = randomHexColor();
  const image = sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: bg,
    },
  });
  return fmt === "png" ? image.png().toBuffer() : image.jpeg({ quality: 85 }).toBuffer();
}

function randomHexColor(): string {
  const n = Math.floor(Math.random() * 0xffffff);
  return `#${n.toString(16).padStart(6, "0")}`;
}

// สร้างอ็อบเจ็กต์ Web File แบบ minimal ให้ persistWebFile ใช้งานได้ (มี .name .type .arrayBuffer())
function makeWebFileFromBuffer(buf: Buffer, filename: string, mime: string) {
  return {
    name: filename,
    type: mime,
    size: buf.length,
    async arrayBuffer(): Promise<ArrayBuffer> {
      // แปลง Buffer -> ArrayBuffer (อย่างถูกต้อง)
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return ab;
    },
  } as unknown as File; // โยน type ให้คล้าย Web File
}

export async function POST(req: NextRequest) {
  console.log("[POST] - dev fake posts with images");

  // กัน production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }

  const body = await req.json();
  const { count = 5, randomize = true } = body;

  // server-side guard
  const guard = requireAdminOrInternal(req);
  if (!guard.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // กำหนดจำนวนรูปต่อโพสต์ (dev fake) — จะทำ 1 รูปต่อโพสต์ (ปรับได้ตามต้องการ)
  const IMAGES_PER_POST = 10;

  const created: any[] = [];
  for (let i = 0; i < count; i++) {
    const title = randomize ? `Test Post ${nanoid(6)}` : `Test Post`;
    const phone = `08${Math.floor(10000000 + Math.random() * 90000000)}`;
    const status = Math.random() > 0.5 ? "public" : "unpublic";
    const content = `Fake content ${new Date().toISOString()}`;

    // 1) insert post
    const sql = `
      INSERT INTO posts (title, phone, body, status, author_id, meta, created_at, fake_test)
      VALUES ($1,$2,$3,$4,$5,$6,NOW(), true)
      RETURNING *
    `;
    const author_id = guard.actor?.id || null;
    const meta = JSON.stringify({
      env: process.env.NODE_ENV,
      generated_by: guard.actor?.id ?? "internal",
    });
    const { rows } = await query(sql, [title, phone, content, status, author_id, meta]);
    const post = rows[0];
    created.push(post);

    // 2) สร้างรูปปลอมฝั่ง server และ persist → files
    const fileRows: { id: string }[] = [];
    for (let k = 0; k < IMAGES_PER_POST; k++) {
      const usePng = Math.random() < 0.5;
      const mime = usePng ? "image/png" : "image/jpeg";
      const ext = usePng ? "png" : "jpg";
      const buf = await createRandomImageBuffer(800, 500, usePng ? "png" : "jpeg");
      const filename = `fake_${nanoid(8)}.${ext}`;

      const webFile = makeWebFileFromBuffer(buf, filename, mime);
      const fileRow = await persistWebFile(webFile); // บันทึกลงตาราง files + ดิสก์ตามระบบเดิม
      fileRows.push(fileRow);
    }

    // 3) ผูกไฟล์เข้ากับ post_images
    if (fileRows.length) {
      const values = fileRows.map((_, i) => `($1, $${i + 2})`).join(", ");
      await query(
        `INSERT INTO post_images (post_id, file_id) VALUES ${values}`,
        [post.id, ...fileRows.map((r) => r.id)]
      );
    }
  }

  return NextResponse.json({ ok: true, created_count: created.length, created });
}
