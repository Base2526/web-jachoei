import { Pool } from "pg";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import crypto from "crypto";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || "appdb",
  user: process.env.POSTGRES_USER || "app",
  password: process.env.POSTGRES_PASSWORD || "app",
});

function formatParams(params?: any[]): string {
  if (!params) return "";
  return params.map((p, i) => `$${i + 1}=${JSON.stringify(p)}`).join(", ");
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    return res;
  } catch (err: any) {
    console.error(
      `[SQL ERROR] ${err.message}\n${text.trim()}\nParams: ${formatParams(params)}`
    );
    throw err;
  }
}

export type TxContext = { revisionId: string };
export type TxWorkResult<T> = { revisionId: string; result: T };

export async function runInTransaction<T>(
  userId: string,
  work: (client: PoolClient, ctx: TxContext) => Promise<T>
): Promise<TxWorkResult<T>> {
  const client = await pool.connect();
  const revisionId = crypto.randomUUID();

  try {
    await client.query("BEGIN");

    // ✅ ใช้ set_config แทน SET LOCAL (รองรับ $1)
    await client.query(`SELECT set_config('app.editor_id',  $1, true)`, [userId]);
    await client.query(`SELECT set_config('app.revision_id', $1, true)`, [revisionId]);

    const result = await work(client, { revisionId });

    await client.query("COMMIT");
    return { revisionId, result };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

process.on("SIGINT", async () => {
  await pool.end().catch(() => void 0);
  process.exit(0);
});
