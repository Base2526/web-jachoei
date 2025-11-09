```ts
import { addLog } from '@/lib/log';

await addLog('info', 'user-login', 'User logged in', { userId: 123 });
```

---

## 🧩 ตัวอย่าง Implementation (Node + Browser ใช้ได้)

สร้างไฟล์ `/apps/web/lib/log.ts`

```ts
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

    // ใช้ fetch แบบ relative จะทำงานทั้งบน client และ server (Next.js)
    const res = await fetch('/api/logs', {
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
```

---

## ✅ ตัวอย่างใช้งาน

### 1) ใน frontend component

```ts
import { addLog } from '@/lib/log';

async function handleLoginSuccess(user: any) {
  await addLog('info', 'auth', `Login success: ${user.email}`, { userId: user.id });
}
```

---

### 2) ใน backend resolver / server function

(กรณีคุณใช้ Next.js App Router + GraphQL Yoga)

```ts
import { addLog } from '@/lib/log';

export const resolvers = {
  Mutation: {
    deleteUser: async (_: any, { id }: { id: string }, ctx: any) => {
      // ... ลบ user
      await addLog('warn', 'admin', `Deleted user ID=${id}`, { editor: ctx.admin?.email });
      return true;
    },
  },
};
```

---

### 3) ใน error handler global

ใน Apollo errorLink หรือใน middleware คุณสามารถเรียก addLog ได้ เช่น:

```ts
import { addLog } from '@/lib/log';

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors?.length) {
    for (const err of graphQLErrors) {
      addLog('error', 'graphql', err.message, err.extensions || {});
    }
  }
  if (networkError) {
    addLog('error', 'network', networkError.message);
  }
});
```

---

## 🧩 API ฝั่ง `/api/logs` (สำหรับ Next.js)

ถ้ายังไม่มี route `/api/logs`, เพิ่มไว้รองรับ `POST`:

```ts
// /apps/web/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db'; // สมมติคุณมี helper query()

export async function POST(req: Request) {
  try {
    const { level, category, message, meta } = await req.json();

    await query(
      `INSERT INTO system_logs (id, action, meta, created_at)
       VALUES (gen_random_uuid(), $1, $2::jsonb, NOW())`,
      [`[${level}] ${category} - ${message}`, meta]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[POST /api/logs] failed', err);
    return NextResponse.json({ error: err.message || 'insert failed' }, { status: 500 });
  }
}
```

> ✅ หรือถ้าคุณมีตาราง `system_logs` ตามที่ให้ไว้แล้ว
> ให้ map field ตรง ๆ (`level`, `category`, `message`, `meta`, `created_by`)

---

## ✅ ขยายฟังก์ชันให้ฉลาดขึ้น (auto scope)

เพิ่ม logic ให้ auto-detect scope (web/admin):

```ts
export async function addLog(level: LogLevel, category: string, message: string, meta: LogMeta = {}) {
  const scope =
    typeof window === 'undefined'
      ? process.env.NODE_ENV === 'production'
        ? 'server'
        : 'dev-server'
      : window.location.pathname.startsWith('/admin')
      ? 'admin'
      : 'web';

  return fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, category, message, scope, meta }),
  }).then(() => true).catch(() => false);
}
```

---

## 🎯 สรุป

| จุดประสงค์                   | วิธีใช้                                              |
| ---------------------------- | ---------------------------------------------------- |
| เรียก log จากทุกที่          | `await addLog('info','category','message',{ meta })` |
| รองรับทั้ง client / server   | ใช้ fetch `/api/logs` แบบ relative                   |
| เขียน log เพิ่มเติมอัตโนมัติ | ฝั่ง `/api/logs` route ใส่ลง `system_logs`           |
| ดู log ทั้งหมด               | ผ่าน `/admin/logs` หน้าที่คุณมีอยู่แล้ว ✅            |

---

อยากให้ผมช่วยเขียน **route `/api/logs`** ให้ครบทุก method (GET / DELETE / POST) เพื่อใช้กับหน้าที่คุณมีอยู่เลยไหมครับ?
จะได้เชื่อมกันแบบ plug-and-play ทันที.
