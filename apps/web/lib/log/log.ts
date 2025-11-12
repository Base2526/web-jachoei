// /apps/web/lib/log.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogMeta {
  [key: string]: any;
}

/**
 * ✅ Global helper สำหรับส่ง log ไป backend /api/logs
 * - ใช้ในทั้ง client และ server component ได้
 * - category = หมวดของ log (เช่น "auth", "user", "payment")
 * - message  = ข้อความหลัก
 * - meta     = object เพิ่มเติม เช่น { userId, ip, error }
 */
export async function addLog(
  level: LogLevel,
  category: string,
  message: string,
  meta: LogMeta = {}
) {
  try {
    const body = JSON.stringify({ level, category, message, meta });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

    // ใช้ fetch แบบ relative จะทำงานทั้งบน client และ server (Next.js)
    const res = await fetch(`${baseUrl}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) {
      console.error(`[addLog] failed: ${res.status}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[addLog] error', err);
    return false;
  }
}
