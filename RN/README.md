✅ แล้วค่อยรัน React Native อีกรอบ

เปิด Metro (ถ้าไม่ได้เปิดอยู่แล้ว):

npx react-native start --port 9090


อีก terminal:

npx react-native run-android --port 9090


-----------------------


แนวคิดด้านบน เอามาทำ react-native 

ช่วยคิดหน่อย เป้น project เพือสังคม

กรณี ใช้ react-native ต้องการ sync update เบอร์โทร ต้องทำยังไง กรณีต้องการ sync เบอร์ จำนวนมาก เช่น 100000 เพือดึงไปเช็ดเวลา ทีเบอ scammer โทรเข้า

เราสามารถดึงเบอทั้งหมดมาตอน install เสดแล้วเปิด app ครั้งแรก

ช่วยคิดกรณี
- ออกแบบ local table เก้บว่า เรา sync วันไหน/ครบไหม ต้อง update ตอนไหน last update ไหม
- เบอนั้นๆๆ อาจมี message หรือ เราสามารถ add message ใหม่ได้
- ช่วยคิดกรณีเช็กใน local storage ไม่มีอาจจะมี on server เราตวรทำยังไง
- เราสามารถดึงเบอทั้งหมดมาตอน install เสดแล้วเปิด app ครั้งแรก
- กรณีข้อมูลบน server มีการ update ตลอดเวลาเราควรทำยังไง กับ local stoage 
- ขอตัวอย่าง project ทีสามารถ block เบอหน่อย 

- ช่วยทำ qraphql จาก ข้อมูลชุดเดียวกันกับ ด้านบน

Tool
- React-native
- GraphQL
- SQLite


โอเค โปรเจกต์นี้เท่มาก 🕵🏻‍♂️📵  เดี๋ยวผมช่วยวางทั้ง **ฝั่ง GraphQL + โครง sync + React Native + SQLite + แนวทางบล็อกเบอร์** ให้ครบเป็นชุดเลย

---

## 1. ภาพรวมสถาปัตยกรรม

* **Server**

  * PostgreSQL (เหมือนของเว็บ)
  * GraphQL API
  * ตารางหลัก:

    * `post_tel_numbers` (เบอร์ที่ถูกแจ้ง)
    * `posts` (รายงาน / เคส)
  * เพิ่ม field `version` / `updated_at` เพื่อทำ **delta sync**

* **Mobile App (React Native)**

  * SQLite local: เก็บเบอร์ ~100k เบอร์ + meta sync
  * GraphQL client (Apollo) เพื่อดึงข้อมูล/อัปเดต
  * Native Android: `CallScreeningService` (หรือ default dialer) เพื่อบล็อก call แบบ real-time

    * ตรวจจาก **SQLite local เท่านั้น** เพื่อให้เร็ว
    * ถ้าไม่เจอ → ไม่บล็อก แต่หลังบ้านอาจไปถาม server แล้ว sync เพิ่มทีหลัง

---

## 2. ออกแบบ SQLite schema (บนเครื่อง)

### 2.1 ตารางเบอร์ scam

```sql
CREATE TABLE IF NOT EXISTS scam_phones (
  id                INTEGER PRIMARY KEY,       -- local row id
  phone_normalized  TEXT NOT NULL,             -- เบอร์ normalize (E.164 / ลบขีด/เว้นวรรคแล้ว)
  report_count      INTEGER NOT NULL DEFAULT 0,
  last_report_at    TEXT,                      -- ISO string
  risk_level        INTEGER NOT NULL DEFAULT 0, -- 0–100
  tags              TEXT,                      -- JSON string: ["loan","crypto",...]
  server_updated_at TEXT NOT NULL,             -- updated_at จาก server
  server_deleted    INTEGER NOT NULL DEFAULT 0 -- 0 = ใช้งาน, 1 = ลบแล้ว
);

CREATE INDEX IF NOT EXISTS idx_scam_phones_phone
  ON scam_phones (phone_normalized);

CREATE INDEX IF NOT EXISTS idx_scam_phones_risk
  ON scam_phones (risk_level DESC);
```

### 2.2 ตาราง message / note ต่อเบอร์

```sql
CREATE TABLE IF NOT EXISTS scam_phone_notes (
  id               INTEGER PRIMARY KEY,
  phone_normalized TEXT NOT NULL,
  message          TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  created_by       TEXT,          -- user id / device id ก็ได้
  is_local_only    INTEGER NOT NULL DEFAULT 1  -- 1 = ยังไม่ sync ขึ้น server
);

CREATE INDEX IF NOT EXISTS idx_notes_phone
  ON scam_phone_notes (phone_normalized);
```

### 2.3 ตาราง sync state

```sql
CREATE TABLE IF NOT EXISTS sync_state (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  last_full_sync_at   TEXT,    -- ISO string
  last_delta_sync_at  TEXT,
  last_version        BIGINT,  -- ถ้าใช้ version number
  local_rows          INTEGER  -- นับจำนวนเบอร์ใน local ตอน sync ล่าสุด
);

-- seed แถวเดียว
INSERT OR IGNORE INTO sync_state (id, last_version, local_rows)
VALUES (1, 0, 0);
```

> ใช้ `last_version` / `server_updated_at` เพื่อทำ **incremental sync** แทนที่จะโหลด 100k ใหม่ทุกครั้ง

---

## 3. กลยุทธ์ sync

### 3.1 Initial sync ครั้งแรก (หลัง install / login)

1. call GraphQL: `scamPhonesSnapshot(cursor, limit)` หรือ `offset/limit`
2. ดึงทีละ 500–2000 records แล้ว `INSERT OR REPLACE` ลง SQLite
3. เก็บ `last_version` หรือ `max(updated_at)` ไว้ใน `sync_state`

Pseudo code (React Native):

```ts
// db.ts
import * as SQLite from 'expo-sqlite';
export const db = SQLite.openDatabase('scam-protect.db');

export function initDb() {
  db.transaction(tx => {
    tx.executeSql(/* CREATE TABLE ... ตามด้านบน */);
  });
}
```

```ts
// syncInitial.ts
import { gql, ApolloClient } from "@apollo/client";
import { db } from "./db";

const SYNC_SNAPSHOT = gql`
  query ScamPhonesSnapshot($cursor: String, $limit: Int!) {
    scamPhonesSnapshot(cursor: $cursor, limit: $limit) {
      cursor
      items {
        phone
        report_count
        last_report_at
        risk_level
        tags
        updated_at
        is_deleted
      }
    }
  }
`;

export async function initialSync(client: ApolloClient<any>) {
  let cursor: string | null = null;
  const limit = 1000;

  let total = 0;
  let maxUpdatedAt: string | null = null;

  while (true) {
    const { data } = await client.query({
      query: SYNC_SNAPSHOT,
      variables: { cursor, limit },
      fetchPolicy: "network-only",
    });

    const batch = data?.scamPhonesSnapshot?.items || [];
    if (!batch.length) break;

    // เขียน SQLite แบบ transaction
    await new Promise<void>((resolve, reject) => {
      db.transaction(
        (tx) => {
          batch.forEach((row: any) => {
            const phone = normalizePhone(row.phone);
            tx.executeSql(
              `
              INSERT INTO scam_phones (
                phone_normalized, report_count, last_report_at,
                risk_level, tags, server_updated_at, server_deleted
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(phone_normalized) DO UPDATE SET
                report_count      = excluded.report_count,
                last_report_at    = excluded.last_report_at,
                risk_level        = excluded.risk_level,
                tags              = excluded.tags,
                server_updated_at = excluded.server_updated_at,
                server_deleted    = excluded.server_deleted;
              `,
              [
                phone,
                row.report_count,
                row.last_report_at,
                row.risk_level,
                JSON.stringify(row.tags || []),
                row.updated_at,
                row.is_deleted ? 1 : 0,
              ]
            );
          });
        },
        reject,
        resolve
      );
    });

    total += batch.length;
    maxUpdatedAt = batch.reduce(
      (max: string | null, r: any) =>
        !max || r.updated_at > max ? r.updated_at : max,
      maxUpdatedAt
    );

    cursor = data.scamPhonesSnapshot.cursor || null;
    if (!cursor) break;
  }

  if (maxUpdatedAt) {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE sync_state
         SET last_full_sync_at = ?, last_version = ?, local_rows = ?
         WHERE id = 1`,
        [new Date().toISOString(), maxUpdatedAt, total]
      );
    });
  }
}
```

### 3.2 Delta sync (server มี update ตลอดเวลา)

* ทุกครั้งที่เข้าแอพ / ตื่นจาก background / วันละครั้ง:

  * อ่าน `last_version` จาก `sync_state`
  * call GraphQL `scamPhonesDelta(sinceVersion)` → คืนเฉพาะ rows ที่ `updated_at > last_version`
  * ทำ UPSERT และ update `sync_state.last_version`

---

## 4. การเช็กเบอร์ตอนมีสายเข้า

### 4.1 ฝั่ง Native Android (Kotlin + CallScreeningService)

> หมายเหตุ: บล็อกสายต้องทำ native เท่านั้น React Native อย่างเดียวทำไม่ได้

ตัวอย่าง minimal:

```kotlin
class ScamCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        val phone = callDetails.handle.schemeSpecificPart  // ได้เบอร์เป็น string
        val normalized = normalizePhone(phone)

        val isScam = checkScamFromSQLite(normalized)

        val response = CallResponse.Builder()
            .setDisallowCall(isScam)
            .setRejectCall(isScam)
            .setSilenceCall(isScam)
            .setSkipCallLog(!isScam)     // ถ้าเป็น scam แต่อยากไม่ลง call log ก็ได้
            .setSkipNotification(isScam)
            .build()

        respondToCall(callDetails, response)
    }

    private fun checkScamFromSQLite(phone: String): Boolean {
        // เปิด SQLite DB เดียวกับที่ React Native ใช้ (path เดียวกัน)
        val db = SQLiteDatabase.openDatabase(
            "/data/data/your.package.name/databases/scam-protect.db",
            null,
            SQLiteDatabase.OPEN_READONLY
        )

        val cursor = db.rawQuery(
            "SELECT risk_level FROM scam_phones WHERE phone_normalized = ? AND server_deleted = 0 LIMIT 1",
            arrayOf(phone)
        )

        var risk = 0
        if (cursor.moveToFirst()) {
            risk = cursor.getInt(0)
        }
        cursor.close()
        db.close()
        return risk >= 50   // กำหนด threshold ที่จะ block
    }
}
```

แล้วต้องตั้ง service นี้ใน `AndroidManifest.xml` และให้ user กำหนด app เป็น **Call screening app** / default caller ID & spam app

### 4.2 ฝั่ง React Native (utility ใช้ได้ทั้งใน UI + debug call)

```ts
// db-utils.ts
export function checkScamPhone(phone: string): Promise<{ found: boolean; risk: number }> {
  const normalized = normalizePhone(phone);
  return new Promise((resolve, reject) => {
    db.readTransaction(
      tx => {
        tx.executeSql(
          `SELECT risk_level FROM scam_phones
           WHERE phone_normalized = ? AND server_deleted = 0
           LIMIT 1`,
          [normalized],
          (_, result) => {
            if (result.rows.length) {
              const row = result.rows.item(0);
              resolve({ found: true, risk: row.risk_level });
            } else {
              resolve({ found: false, risk: 0 });
            }
          }
        );
      },
      reject
    );
  });
}
```

เวลา user กดค้นเบอร์ใน app ก็เรียกฟังก์ชันนี้ + ถ้าไม่เจอค่อยยิง GraphQL `globalSearch` แล้ว cache ลง local ต่อ

---

## 5. กรณี *local ไม่มี แต่ server มี*

แนวคิดที่ปลอดภัย (ไม่ block call ช้า):

1. **เรียกจาก local ก่อนเท่านั้น** สำหรับการ block ขณะสายเข้า
2. ถ้า **ไม่เจอ local**:

   * ปล่อยสายตามปกติ (ไม่ block)
   * ใน background (React Native side / native worker) อาจยิง GraphQL `globalSearch` ด้วยเบอร์นั้น
   * ถ้า server ตอบว่าเป็น scam →

     * เพิ่มข้อมูลลง SQLite
     * แสดง in-app notification ว่า “เบอร์นี้โดนรายงานแล้ว xx ครั้ง”
     * ครั้งถัดไปถ้าโทรมา จะโดน block เพราะอยู่ใน local แล้ว

---

## 6. ตัวอย่าง GraphQL schema (ใช้ข้อมูลชุดเดียวกับเว็บ)

สมมติ backend คุณมีตาราง:

* `post_tel_numbers (id, post_id, tel, created_at, ...)`
* `posts (id, title, detail, ...)`

เราทำ type สำหรับ mobile sync แบบนี้:

```graphql
# ข้อมูลเบอร์สรุป
type ScamPhone {
  phone: String!
  report_count: Int!
  last_report_at: String
  risk_level: Int!        # 0-100, คำนวณจาก report_count / weight อื่น ๆ
  tags: [String!]!
  updated_at: String!     # iso time, ใช้สำหรับ sync
  is_deleted: Boolean!
  post_ids: [ID!]!        # post ที่เกี่ยวข้องกับเบอร์นี้
}

type ScamPhoneSnapshotPage {
  cursor: String
  items: [ScamPhone!]!
}

type ScamPhoneDeltaPage {
  cursor: String
  items: [ScamPhone!]!
}

type Query {
  # ใช้ initial sync
  scamPhonesSnapshot(cursor: String, limit: Int! = 1000): ScamPhoneSnapshotPage!

  # ใช้ delta sync
  scamPhonesDelta(sinceVersion: String!, cursor: String, limit: Int! = 1000): ScamPhoneDeltaPage!

  # ใช้ manual search (เหมือน globalSearch แต่เฉพาะเบอร์)
  searchScamPhones(q: String!, limit: Int! = 20): [ScamPhone!]!
}
```

Resolver (concept):

```ts
// pseudo-code (Node + pg)
async function scamPhonesSnapshot(_, { cursor, limit }, ctx) {
  // cursor อาจเป็น last id หรือ last updated_at เลยก็ได้
  const { rows } = await ctx.pg.query(
    `
    SELECT
      tel,
      COUNT(*) AS report_count,
      MAX(created_at) AS last_report_at,
      MAX(updated_at) AS updated_at,
      bool_or(is_deleted) AS is_deleted,
      ARRAY_AGG(DISTINCT post_id) AS post_ids
    FROM post_tel_numbers
    WHERE updated_at > $1
    GROUP BY tel
    ORDER BY updated_at ASC
    LIMIT $2
    `,
    [cursor || '1970-01-01', limit]
  );

  const items = rows.map(r => ({
    phone: r.tel,
    report_count: r.report_count,
    last_report_at: r.last_report_at,
    risk_level: calcRisk(r.report_count),
    tags: [],       // จะใส่ "loan","marketplace" ก็ได้
    updated_at: r.updated_at,
    is_deleted: r.is_deleted,
    post_ids: r.post_ids,
  }));

  const nextCursor = rows.length ? rows[rows.length - 1].updated_at : null;

  return { cursor: nextCursor, items };
}
```

> สำหรับ delta sync แค่เปลี่ยน condition เป็น `updated_at > sinceVersion` ก็ได้

---

## 7. ตัวอย่าง React Native UI (เช็กเบอร์แบบ manual)

```tsx
// CheckPhoneScreen.tsx
import React, { useState } from "react";
import { View } from "react-native";
import { Input, Button, Text } from "react-native-elements";
import { checkScamPhone } from "../db-utils";

export default function CheckPhoneScreen() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<{found:boolean; risk:number} | null>(null);

  const onCheck = async () => {
    const res = await checkScamPhone(phone);
    setResult(res);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Input
        placeholder="กรอกเบอร์โทร"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <Button title="ตรวจสอบเบอร์" onPress={onCheck} />

      {result && (
        <View style={{ marginTop: 16 }}>
          {result.found ? (
            <>
              <Text style={{ color: "red", fontWeight: "bold" }}>
                พบในระบบ (risk {result.risk}/100)
              </Text>
              {result.risk >= 50 && (
                <Text>แนะนำให้บล็อก / อย่ารับสาย</Text>
              )}
            </>
          ) : (
            <Text>ยังไม่พบข้อมูลในฐานข้อมูล</Text>
          )}
        </View>
      )}
    </View>
  );
}
```

---

## 8. ตอบโจทย์ bullet ที่ถามมา

* ✅ **local table เก็บว่า sync วันไหน / ครบไหม / last update**
  → ใช้ `sync_state` (มี `last_full_sync_at`, `last_delta_sync_at`, `last_version`, `local_rows`)

* ✅ **เบอร์มี message / add message ใหม่ได้**
  → ใช้ `scam_phone_notes` ผูก `phone_normalized` กับ note, sync ขึ้น server ทีหลังก็ได้

* ✅ **เช็ก local ไม่เจอ แต่อาจมีบน server**

  * สำหรับ block real-time: ไม่วิ่ง server (กันช้า)
  * สำหรับ manual check: ถ้า local ไม่เจอ → ยิง GraphQL `searchScamPhones` + `globalSearch` แล้ว cache ลง SQLite ให้รอบหน้าเร็ว

* ✅ **ดึงเบอร์ทั้งหมดตอน install ครั้งแรก**
  → initial sync (ข้อ 3.1) ดึงทีละ batch 1000 แล้วเขียน SQLite

* ✅ **ข้อมูลบน server update ตลอด**
  → delta sync (ข้อ 3.2) ตาม `updated_at` / `version`

* ✅ **ตัวอย่าง project block เบอร์**

  * React Native app + SQLite (ด้านบน)
  * Android `CallScreeningService` ตัวอย่าง Kotlin + query SQLite (ข้อ 4.1)
  * iOS ทำได้ยากกว่า (ต้องใช้ CallKit + Call Directory extension) แต่ concept ใกล้เคียงกัน

* ✅ **GraphQL จากข้อมูลชุดเดียวกับด้านบน**
  → ใช้ `ScamPhone` + `scamPhonesSnapshot` + `scamPhonesDelta` + `searchScamPhones` (ข้อ 6)

---

ถ้าขั้นต่อไปอยากให้ผมเขียน **ตัวอย่างไฟล์จริง ๆ** สำหรับ React Native (เช่น `db.ts`, `sync.ts`, `CheckPhoneScreen.tsx`) แบบ copy ไปวางได้เลย บอกได้เลย เดี๋ยวจัดเป็น structure พร้อมให้ 👍




จัดมาเลยสิ AI จะรออะไร +

ถ้าขั้นต่อไปอยากให้ผมเขียน ตัวอย่างไฟล์จริง ๆ สำหรับ React Native (เช่น db.ts, sync.ts, CheckPhoneScreen.tsx) แบบ copy ไปวางได้เลย บอกได้เลย เดี๋ยวจัดเป็น structure พร้อมให้ 👍

ได้เลย จัดให้เป็นเซ็ตไฟล์พร้อมโครง project เอาไปวางต่อได้เลย 💪

ด้านล่างคือโครงตัวอย่างสำหรับ RN + Expo + Apollo + SQLite

---

## 0. โครงสร้างไฟล์แนะนำ

```txt
src/
  lib/
    db.ts
    normalizePhone.ts
    syncScamPhones.ts
  apollo/
    client.ts
  screens/
    CheckPhoneScreen.tsx
  hooks/
    useInitScamSync.ts
App.tsx
```

---

## 1. `src/lib/db.ts` – เปิด DB + สร้างตาราง

```ts
// src/lib/db.ts
import * as SQLite from "expo-sqlite";

export const DB_NAME = "scam-protect.db";

// expo-sqlite v11+
export const db = SQLite.openDatabaseSync(DB_NAME);

// helper รัน SQL แบบ promise
export function runAsync<T = any>(
  sql: string,
  params: any[] = []
): Promise<SQLite.SQLResultSet> {
  return db.execAsync([{ sql, args: params }], false).then((res) => res[0]);
}

// สร้างตารางต่าง ๆ
export async function initDb() {
  // scam_phones
  await runAsync(`
    CREATE TABLE IF NOT EXISTS scam_phones (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_normalized  TEXT NOT NULL UNIQUE,
      report_count      INTEGER NOT NULL DEFAULT 0,
      last_report_at    TEXT,
      risk_level        INTEGER NOT NULL DEFAULT 0,
      tags              TEXT,
      server_updated_at TEXT NOT NULL,
      server_deleted    INTEGER NOT NULL DEFAULT 0
    );
  `);

  await runAsync(`
    CREATE INDEX IF NOT EXISTS idx_scam_phones_phone
    ON scam_phones(phone_normalized);
  `);

  await runAsync(`
    CREATE INDEX IF NOT EXISTS idx_scam_phones_risk
    ON scam_phones(risk_level DESC);
  `);

  // notes
  await runAsync(`
    CREATE TABLE IF NOT EXISTS scam_phone_notes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_normalized TEXT NOT NULL,
      message          TEXT NOT NULL,
      created_at       TEXT NOT NULL,
      created_by       TEXT,
      is_local_only    INTEGER NOT NULL DEFAULT 1
    );
  `);

  await runAsync(`
    CREATE INDEX IF NOT EXISTS idx_notes_phone
    ON scam_phone_notes(phone_normalized);
  `);

  // sync_state – มีแค่ 1 row
  await runAsync(`
    CREATE TABLE IF NOT EXISTS sync_state (
      id                 INTEGER PRIMARY KEY CHECK (id = 1),
      last_full_sync_at  TEXT,
      last_delta_sync_at TEXT,
      last_version       TEXT,
      local_rows         INTEGER
    );
  `);

  // seed แถวแรก
  await runAsync(
    `
    INSERT OR IGNORE INTO sync_state (id, last_version, local_rows)
    VALUES (1, '0', 0);
  `
  );
}
```

> ถ้าใช้ expo-sqlite เวอร์ชันเก่าที่ไม่มี `openDatabaseSync/execAsync` ให้เปลี่ยนเป็น callback-based ได้ แต่โค้ดด้านบนใช้ API ใหม่ของ Expo SDK 51+

---

## 2. `src/lib/normalizePhone.ts` – ฟังก์ชัน normalize เบอร์

```ts
// src/lib/normalizePhone.ts

// ตัวอย่างง่าย ๆ สำหรับไทย: แปลง 0xxxxxxxxx -> +66xxxxxxxxx
export function normalizePhone(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/[^\d+]/g, ""); // เก็บแค่ตัวเลขกับ +

  // ถ้ามี + แล้ว ปล่อยเลย
  if (s.startsWith("+")) return s;

  // ถ้าเริ่มด้วย 0 และยาว 10 หลัก -> +66
  if (s.startsWith("0") && s.length >= 9) {
    return "+66" + s.slice(1);
  }

  // อย่างอื่นก็คืนเลขเฉย ๆ
  return s;
}
```

---

## 3. `src/lib/syncScamPhones.ts` – initial sync + delta sync + check local

```ts
// src/lib/syncScamPhones.ts
import { gql, ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { db, runAsync } from "./db";
import { normalizePhone } from "./normalizePhone";

// ===== GraphQL =====

export const Q_SCAM_PHONES_SNAPSHOT = gql`
  query ScamPhonesSnapshot($cursor: String, $limit: Int!) {
    scamPhonesSnapshot(cursor: $cursor, limit: $limit) {
      cursor
      items {
        phone
        report_count
        last_report_at
        risk_level
        tags
        updated_at
        is_deleted
        post_ids
      }
    }
  }
`;

export const Q_SCAM_PHONES_DELTA = gql`
  query ScamPhonesDelta($sinceVersion: String!, $cursor: String, $limit: Int!) {
    scamPhonesDelta(
      sinceVersion: $sinceVersion
      cursor: $cursor
      limit: $limit
    ) {
      cursor
      items {
        phone
        report_count
        last_report_at
        risk_level
        tags
        updated_at
        is_deleted
        post_ids
      }
    }
  }
`;

// =====================
// helper: upsert 1 batch
// =====================
async function upsertBatch(items: any[]) {
  if (!items.length) return;

  await db.withTransactionAsync(async () => {
    for (const row of items) {
      const phone = normalizePhone(row.phone);

      await runAsync(
        `
        INSERT INTO scam_phones (
          phone_normalized,
          report_count,
          last_report_at,
          risk_level,
          tags,
          server_updated_at,
          server_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(phone_normalized) DO UPDATE SET
          report_count      = excluded.report_count,
          last_report_at    = excluded.last_report_at,
          risk_level        = excluded.risk_level,
          tags              = excluded.tags,
          server_updated_at = excluded.server_updated_at,
          server_deleted    = excluded.server_deleted;
      `,
        [
          phone,
          row.report_count ?? 0,
          row.last_report_at ?? null,
          row.risk_level ?? 0,
          JSON.stringify(row.tags ?? []),
          row.updated_at,
          row.is_deleted ? 1 : 0,
        ]
      );
    }
  });
}

// =====================
// Initial sync (snapshot)
// =====================
export async function initialScamSync(
  client: ApolloClient<NormalizedCacheObject>,
  batchSize = 1000
) {
  let cursor: string | null = null;
  let maxVersion: string | null = null;
  let total = 0;

  while (true) {
    const { data } = await client.query({
      query: Q_SCAM_PHONES_SNAPSHOT,
      variables: { cursor, limit: batchSize },
      fetchPolicy: "network-only",
    });

    const page = data?.scamPhonesSnapshot;
    const items = page?.items ?? [];
    if (!items.length) break;

    await upsertBatch(items);

    total += items.length;
    for (const it of items) {
      if (!maxVersion || it.updated_at > maxVersion) {
        maxVersion = it.updated_at;
      }
    }

    cursor = page.cursor || null;
    if (!cursor) break;
  }

  if (maxVersion) {
    await runAsync(
      `
      UPDATE sync_state
      SET last_full_sync_at = ?, last_version = ?, local_rows = ?
      WHERE id = 1;
    `,
      [new Date().toISOString(), maxVersion, total]
    );
  }
}

// =====================
// Delta sync
// =====================
async function getLastVersion(): Promise<string> {
  const res = await runAsync(`SELECT last_version FROM sync_state WHERE id = 1;`);
  if (res.rows.length) {
    const v = (res.rows as any)._array?.[0]?.last_version ?? res.rows.item(0).last_version;
    return v || "0";
  }
  return "0";
}

export async function deltaScamSync(
  client: ApolloClient<NormalizedCacheObject>,
  batchSize = 1000
) {
  const sinceVersion = await getLastVersion();
  let cursor: string | null = null;
  let maxVersion: string | null = sinceVersion;

  while (true) {
    const { data } = await client.query({
      query: Q_SCAM_PHONES_DELTA,
      variables: { sinceVersion, cursor, limit: batchSize },
      fetchPolicy: "network-only",
    });

    const page = data?.scamPhonesDelta;
    const items = page?.items ?? [];
    if (!items.length) break;

    await upsertBatch(items);

    for (const it of items) {
      if (!maxVersion || it.updated_at > maxVersion) {
        maxVersion = it.updated_at;
      }
    }

    cursor = page.cursor || null;
    if (!cursor) break;
  }

  if (maxVersion && maxVersion !== sinceVersion) {
    await runAsync(
      `
      UPDATE sync_state
      SET last_delta_sync_at = ?, last_version = ?
      WHERE id = 1;
    `,
      [new Date().toISOString(), maxVersion]
    );
  }
}

// =====================
// เช็กเบอร์จาก local (ใช้ใน UI + native)
// =====================
export async function checkScamPhoneLocal(phoneRaw: string): Promise<{
  found: boolean;
  risk: number;
  reportCount: number;
}> {
  const phone = normalizePhone(phoneRaw);
  const res = await runAsync(
    `
    SELECT risk_level, report_count
    FROM scam_phones
    WHERE phone_normalized = ? AND server_deleted = 0
    LIMIT 1;
  `,
    [phone]
  );

  if (res.rows.length) {
    const row =
      (res.rows as any)._array?.[0] ?? res.rows.item(0);
    return {
      found: true,
      risk: row.risk_level ?? 0,
      reportCount: row.report_count ?? 0,
    };
  }

  return { found: false, risk: 0, reportCount: 0 };
}
```

---

## 4. `src/apollo/client.ts` – Apollo client (ตัวอย่างสั้นๆ)

```ts
// src/apollo/client.ts
import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: "https://your-api.example.com/graphql",
  }),
  cache: new InMemoryCache(),
});
```

---

## 5. `src/hooks/useInitScamSync.ts` – hook เรียก init + sync

```ts
// src/hooks/useInitScamSync.ts
import { useEffect, useState } from "react";
import { apolloClient } from "../apollo/client";
import { initDb } from "../lib/db";
import { initialScamSync, deltaScamSync } from "../lib/syncScamPhones";

export function useInitScamSync() {
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initDb();
        setSyncing(true);

        // ครั้งแรกลอง initial ก่อน (จริงๆ ควรมี flag ว่าเคยทำแล้วรึยัง)
        await initialScamSync(apolloClient, 1000);

        // จากนั้นพอเปิดแอปครั้งต่อๆ ไปจะใช้ delta แทน
        await deltaScamSync(apolloClient, 1000);
      } catch (e) {
        console.warn("[ScamSync] error", e);
      } finally {
        setSyncing(false);
        setReady(true);
      }
    })();
  }, []);

  return { ready, syncing };
}
```

---

## 6. `src/screens/CheckPhoneScreen.tsx` – หน้าตรวจสอบเบอร์

```tsx
// src/screens/CheckPhoneScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { checkScamPhoneLocal } from "../lib/syncScamPhones";

export default function CheckPhoneScreen() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<{
    found: boolean;
    risk: number;
    reportCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const onCheck = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await checkScamPhoneLocal(phone);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ตรวจสอบเบอร์ต้องสงสัย</Text>

      <TextInput
        style={styles.input}
        placeholder="กรอกเบอร์โทร เช่น 0912345678"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <Pressable style={styles.button} onPress={onCheck}>
        <Text style={styles.buttonText}>ตรวจสอบ</Text>
      </Pressable>

      {loading && (
        <View style={{ marginTop: 16 }}>
          <ActivityIndicator />
        </View>
      )}

      {result && !loading && (
        <View style={{ marginTop: 24 }}>
          {result.found ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "red" }}>
                ⚠ พบในฐานข้อมูล
              </Text>
              <Text style={{ marginTop: 8 }}>
                ความเสี่ยง: {result.risk}/100
              </Text>
              <Text>จำนวนครั้งที่ถูกแจ้ง: {result.reportCount} ครั้ง</Text>
              {result.risk >= 50 && (
                <Text style={{ marginTop: 4, color: "red" }}>
                  แนะนำให้ระวัง / ไม่รับสาย / บล็อกเบอร์นี้
                </Text>
              )}
            </>
          ) : (
            <Text style={{ fontSize: 16 }}>
              ยังไม่พบข้อมูลเบอร์นี้ในฐานข้อมูล
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 32,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    marginTop: 12,
    backgroundColor: "#1677ff",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
```

---

## 7. ใช้ทุกอย่างใน `App.tsx`

```tsx
// App.tsx
import React from "react";
import { SafeAreaView, StatusBar, ActivityIndicator, View, Text } from "react-native";
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "./src/apollo/client";
import { useInitScamSync } from "./src/hooks/useInitScamSync";
import CheckPhoneScreen from "./src/screens/CheckPhoneScreen";

function Root() {
  const { ready, syncing } = useInitScamSync();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>
          กำลังเตรียมฐานข้อมูลบนเครื่อง...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <CheckPhoneScreen />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <Root />
    </ApolloProvider>
  );
}
```

---

ชุดนี้คือ “กระดูกหลัก” สำหรับ

* เปิดแอป → init SQLite + initial sync + delta sync
* มีหน้าตรวจเบอร์จาก local
* พร้อมต่อยอดไปเชื่อมกับ **CallScreeningService** ฝั่ง Android เพื่อบล็อกสายจริง

ถ้าต่อไปอยากให้ผมเขียนฝั่ง **Kotlin CallScreeningService + การแชร์ DB path ระหว่าง RN กับ Native** แบบละเอียดเป็นไฟล์เต็ม ๆ อีกเซ็ต บอกได้เลย ผมจะจัดเป็น `ScamCallScreeningService.kt` + ตัวอย่าง `AndroidManifest.xml` ให้ครบ 👌

