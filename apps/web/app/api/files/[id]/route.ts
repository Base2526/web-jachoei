// /api/files/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import fs from "fs";
import path from "path";
import { STORAGE_DIR } from "@/lib/storage";

export const dynamic = "force-dynamic";

function guessMimeFromName(name: string) {
  const ext = path.extname(name || "").toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "";
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  // ✅ ดึง filename/original_name มาด้วยถ้ามีคอลัมน์
  const { rows } = await query(
    `SELECT mimetype, relpath, filename, original_name
     FROM files
     WHERE id=$1 AND deleted_at IS NULL`,
    [id]
  );

  const row = rows[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const full = path.join(STORAGE_DIR, row.relpath);
  if (!fs.existsSync(full)) return NextResponse.json({ error: "file missing" }, { status: 404 });

  let mime = (row.mimetype || "").toString().trim().toLowerCase();

  // ✅ ถ้า DB ให้ octet-stream หรือไม่ใช่ image → เดาจากชื่อไฟล์/relpath
  if (!mime.startsWith("image/")) {
    const fromName =
      guessMimeFromName(row.filename || "") ||
      guessMimeFromName(row.original_name || "") ||
      guessMimeFromName(row.relpath || "");
    if (fromName) mime = fromName;
  }

  const data = await fs.promises.readFile(full);

  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": mime || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
