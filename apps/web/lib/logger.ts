import { query } from "@/lib/db";

export type LogLevel = "debug" | "info" | "warn" | "error";

export async function syslog(message:string, opts?: {
  level?: LogLevel,
  category?: string,
  meta?: any,
  user_id?: number|null,
}){
  const level = opts?.level || "info";
  const category = opts?.category || "app";
  const meta = opts?.meta || {};
  const user_id = opts?.user_id ?? null;
  try{
    await query(
      `INSERT INTO system_logs(level, category, message, meta, created_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [ level, category, message, JSON.stringify(meta), user_id ]
    );
  }catch(e){
    console.error("[syslog insert failed]", e);
  }
}
