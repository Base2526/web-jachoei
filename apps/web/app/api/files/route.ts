import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ensureStorage, dateDir, makeSafeName } from "@/lib/storage";

export const dynamic = "force-dynamic";

// GET /api/files?q=keyword&page=1&pageSize=20
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;

  const where = q ? "WHERE deleted_at IS NULL AND (LOWER(original_name) LIKE LOWER($1) OR LOWER(filename) LIKE LOWER($1))" : "WHERE deleted_at IS NULL";
  const args:any[] = q ? [ `%${q}%`, pageSize, offset ] : [ pageSize, offset ];

  const { rows } = await query(
    `SELECT id, filename, original_name, mimetype, size, checksum, relpath, created_at, updated_at
       FROM files
       ${where}
       ORDER BY created_at DESC
       LIMIT $${q?2:1} OFFSET $${q?3:2}`,
    args
  );

  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*)::int AS count FROM files ${q? "WHERE deleted_at IS NULL AND (LOWER(original_name) LIKE LOWER($1) OR LOWER(filename) LIKE LOWER($1))":"WHERE deleted_at IS NULL"}`,
    q? [ `%${q}%` ]: []
  );

  return NextResponse.json({ items: rows, total: count, page, pageSize });
}

// POST multipart upload
export async function POST(req: NextRequest) {
  ensureStorage();
  const form = await req.formData();
  const file = form.get("file");
  const renameTo = (form.get("name") as string) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  const checksum = crypto.createHash("sha256").update(buf).digest("hex");

  const safeName = makeSafeName(renameTo || file.name);
  const dir = dateDir();
  const ts = Date.now();
  const filename = `${ts}-${safeName}`;
  const full = path.join(dir, filename);
  await fs.promises.writeFile(full, buf);

  const rel = full.replace((process.env.STORAGE_DIR || "/app/storage") + path.sep, "");

  const { rows } = await query(
    `INSERT INTO files (filename, original_name, mimetype, size, checksum, relpath)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, filename, original_name, mimetype, size, checksum, relpath, created_at, updated_at`,
    [ filename, file.name, file.type || null, buf.length, checksum, rel ]
  );

  return NextResponse.json(rows[0], { status: 201 });
}
