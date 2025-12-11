import { Pool } from "pg";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || "appdb",
  user: process.env.POSTGRES_USER || "app",
  password: process.env.POSTGRES_PASSWORD || "app",
});

// helper: แปลง params เป็น string สำหรับ debug
function formatParams(params?: any[]): string {
  if (!params) return "";
  return params.map((p, i) => `$${i + 1}=${JSON.stringify(p)}`).join(", ");
}

// ใช้สำหรับ query ปกติ (auto-acquire/auto-release)
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    // === Print log after successful query ===
    // console.log(
    //   `[SQL ${duration}ms]\n${text.trim()}\nParams: ${formatParams(params)}`
    // );
    return res;
  } catch (err: any) {
    console.error(
      `[SQL ERROR] ${err.message}\n${text.trim()}\nParams: ${formatParams(params)}`
    );
    throw err;
  }
}

/**
 * รันงานภายใน Transaction ให้หมดใน callback
 * - เริ่มด้วย BEGIN
 * - commit อัตโนมัติเมื่อ callback สำเร็จ
 * - rollback อัตโนมัติเมื่อ callback throw error
 * - ปล่อย client คืน pool เสมอ
 */
export async function runInTransaction<T>(
  userId: string,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // NOTE: ระวัง SQL injection ถ้า userId มาจากภายนอก
    await client.query(`SET LOCAL app.editor_id = '${userId}'`);

    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // swallow rollback error
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * เผื่อบางกรณีอยากได้ client มาใช้เอง (ไม่เริ่ม transaction ให้)
 * - อย่าลืม client.release() เองเมื่อใช้เสร็จ
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

// ปิด pool เวลาปิดโปรเซส (optional but nice to have)
process.on("SIGINT", async () => {
  await pool.end().catch(() => void 0);
  process.exit(0);
});

/*
ตัวอย่างการใช้:

import { runInTransaction } from "@/lib/db";

await runInTransaction("123", async (client) => {
  const { rows } = await client.query<{ id: number }>(
    "INSERT INTO posts (title, body) VALUES ($1,$2) RETURNING id",
    ["hello", "world"]
  );
  const postId = rows[0].id;

  await client.query(
    "INSERT INTO post_revisions (post_id, title, body, note) VALUES ($1,$2,$3,$4)",
    [postId, "hello", "world", "initial create"]
  );

  // ถ้าต้องการส่งค่ากลับ
  return postId;
});

*/