import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const { rows } = await query(
    `SELECT id, level, category, message, meta, created_by, created_at
       FROM system_logs
      WHERE id = $1
      LIMIT 1`,
    [id]
  );

  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Log not found" }, { status: 404 });
  return NextResponse.json(row);
}
