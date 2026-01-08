// apps/web/lib/log/writeLog.server.ts
import type { LogLevel, LogMeta } from "./types";

export async function writeLogServer(
  level: LogLevel,
  category: string,
  message: string,
  meta: LogMeta = {}
) {
  // ✅ TODO: คุณจะ insert DB จริง ๆ ก็ใส่ตรงนี้
  // ตอนนี้ทำเป็น console เพื่อให้ไม่พัง flow ก่อน
  const payload = {
    level,
    category,
    message,
    meta,
    at: new Date().toISOString(),
  };

  // ปรับตรงนี้ได้ตามระบบ log ของคุณ
  if (level === "error") console.error("[LOG]", payload);
  else if (level === "warn") console.warn("[LOG]", payload);
  else console.log("[LOG]", payload);

  return true;
}
