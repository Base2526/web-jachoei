import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// GET -> download
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const { rows } = await query(`SELECT * FROM files WHERE id=$1 AND deleted_at IS NULL`, [id]);
  const file = rows[0];
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const full = path.join(process.env.STORAGE_DIR || "/app/storage", file.relpath);
  const stat = await fs.promises.stat(full);
  const data = await fs.promises.readFile(full);

  return new NextResponse(data, {
    headers: {
      "Content-Type": file.mimetype || "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.original_name || file.filename)}"`,
    }
  });
}

// PATCH -> rename
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const body = await req.json().catch(() => ({}));
  const newName = (body?.name || "").toString().trim();
  if (!newName) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { rows } = await query(
    `UPDATE files SET filename=$1, updated_at=NOW()
     WHERE id=$2 AND deleted_at IS NULL
     RETURNING id, filename, original_name, mimetype, size, checksum, relpath, created_at, updated_at`,
    [ newName, id ]
  );
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

// DELETE -> soft delete
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const { rowCount } = await query(`UPDATE files SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, [id]);
  if (!rowCount) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
