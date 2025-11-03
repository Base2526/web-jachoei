// apps/web/lib/storage.ts
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import crypto from "crypto";
import { query } from "@/lib/db";

export const STORAGE_DIR = process.env.STORAGE_DIR || "/app/storage";

/** แน่ใจว่ามีโฟลเดอร์เก็บไฟล์ */
export function ensureStorage() {
  if (!existsSync(STORAGE_DIR)) {
    // mkdir sync ไม่ได้บน edge/runtime, ใช้ promises ดีกว่า
  }
}

/** โฟลเดอร์ย่อยตามวันที่: STORAGE_DIR/YYYY/MM/DD */
export function dateDir() {
  const now = new Date();
  const p = path.join(
    STORAGE_DIR,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  );
  return p;
}

/** ทำชื่อไฟล์ให้ปลอดภัย */
export function makeSafeName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(0, 180);
}

/** รับ Web File → เซฟลง STORAGE_DIR → คืนข้อมูล row ในตาราง files */
export async function persistWebFile(file: File, renameTo?: string) {
  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);
  const checksum = crypto.createHash("sha256").update(buf).digest("hex");

  const dir = dateDir();
  await mkdir(dir, { recursive: true });

  const safeName = makeSafeName(renameTo || file.name || "file.bin");
  const ts = Date.now();
  const filename = `${ts}-${safeName}`;
  const full = path.join(dir, filename);

  await writeFile(full, buf);

  // เก็บ path แบบ relative เพื่อย้าย STORAGE_DIR ได้ในอนาคต
  const rel = full.replace(STORAGE_DIR + path.sep, "");

  const { rows } = await query(
    `INSERT INTO files (filename, original_name, mimetype, size, checksum, relpath)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, filename, original_name, mimetype, size, checksum, relpath, created_at, updated_at`,
    [filename, file.name || null, file.type || null, buf.length, checksum, rel]
  );

  return rows[0] as {
    id: number;
    filename: string;
    original_name: string | null;
    mimetype: string | null;
    size: number;
    checksum: string;
    relpath: string;
    created_at: string;
    updated_at: string;
  };
}

/** สร้าง URL เสิร์ฟไฟล์ (แบบ REST ผ่าน id) */
export function buildFileUrlById(id: number) {
  return `/api/files/${id}`; // เราจะทำ route เสิร์ฟไฟล์ข้อ 4
}
