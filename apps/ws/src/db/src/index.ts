// import { Pool } from 'pg';

// const pool = new Pool({
//   host: process.env.POSTGRES_HOST || 'postgres',
//   port: Number(process.env.POSTGRES_PORT || 5432),
//   database: process.env.POSTGRES_DB || 'appdb',
//   user: process.env.POSTGRES_USER || 'app',
//   password: process.env.POSTGRES_PASSWORD || 'app',
// });
// export const query = (text: string, params?: any[]) => pool.query(text, params);

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}