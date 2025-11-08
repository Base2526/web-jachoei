import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /admin/api/logs?q=&level=&category=&page=&pageSize=
export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q")||"").trim();
  const level = (searchParams.get("level")||"").trim();
  const category = (searchParams.get("category")||"").trim();
  const page = Math.max(1, parseInt(searchParams.get("page")||"1",10));
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize")||"50",10)));
  const offset = (page-1)*pageSize;

  const conds:string[] = [];
  const args:any[] = [];
  if(q){ args.push(`%${q}%`); conds.push("(LOWER(message) LIKE LOWER($"+args.length+") OR LOWER(level) LIKE LOWER($"+args.length+") OR LOWER(category) LIKE LOWER($"+args.length+"))"); }
  if(level){ args.push(level); conds.push("level = $"+args.length); }
  if(category){ args.push(category); conds.push("category = $"+args.length); }

  const where = conds.length? "WHERE "+conds.join(" AND "): "";
  const listSQL = `SELECT id, level, category, message, meta, created_by, created_at
                   FROM system_logs
                   ${where}
                   ORDER BY created_at DESC
                   LIMIT $${args.length+1} OFFSET $${args.length+2}`;
  const countSQL = `SELECT COUNT(*)::int AS count FROM system_logs ${where}`;

  const listArgs = args.concat([pageSize, offset]);
  const { rows } = await query(listSQL, listArgs);
  const { rows: [{ count }] } = await query(countSQL, args);

  return NextResponse.json({ items: rows, total: count, page, pageSize });
}

// POST /admin/api/logs  -> create test log
export async function POST(req: NextRequest){
  const body = await req.json().catch(()=>({} as any));
  const level = body?.level || "info";
  const category = body?.category || "manual";
  const message = body?.message || "Manual log entry";
  const meta = body?.meta || {};
  const user_id = body?.user_id ?? null;

  const { rows:[row] } = await query(
    `INSERT INTO system_logs(level, category, message, meta, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [ level, category, message, JSON.stringify(meta), user_id ]
  );
  return NextResponse.json(row, { status: 201 });
}

// DELETE /admin/api/logs  -> purge by filter (careful; requires either level/category/q to be set)
// export async function DELETE(req: NextRequest){
//   const { searchParams } = new URL(req.url);
//   const q = (searchParams.get("q")||"").trim();
//   const level = (searchParams.get("level")||"").trim();
//   const category = (searchParams.get("category")||"").trim();

//   const conds:string[] = [];
//   const args:any[] = [];
//   if(q){ args.push(`%${q}%`); conds.push("(LOWER(message) LIKE LOWER($"+args.length+"))"); }
//   if(level){ args.push(level); conds.push("level = $"+args.length); }
//   if(category){ args.push(category); conds.push("category = $"+args.length); }

//   if(!conds.length) return NextResponse.json({ error: "Refuse to purge without any condition" }, { status: 400 });

//   const sql = `DELETE FROM system_logs WHERE `+conds.join(" AND ");
//   const result = await query(sql, args);
//   return NextResponse.json({ deleted: result.rowCount||0 });
// }

// DELETE /api/logs?ids=1,2,3  | หรือใช้ body JSON ก็ได้
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get('ids');

  if (!idsParam) {
    return new Response(JSON.stringify({ error: 'Missing ids' }), { status: 400 });
  }

  const ids = idsParam
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));

  if (ids.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid ids' }), { status: 400 });
  }

  const { rowCount } = await query(
    `DELETE FROM system_logs WHERE id = ANY($1::int[])`,
    [ids]
  );

  return new Response(JSON.stringify({ deleted: rowCount }), { status: 200 });
}


