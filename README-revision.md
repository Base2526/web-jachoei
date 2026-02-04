ประเด็นที่คุณถามมาคือ

> posts มี revision 100, แต่ post_seller_accounts มี revision แค่ 10
> แล้วเวลา “ย้อนดู/จับคู่” ว่า post revision ไหนควรใช้ post_seller_accounts revision ไหน ทำยังไงดี?

ผมจะปรับสคริปต์ให้มี **revision_group_id (UUID)** เอาไว้ “ผูกชุดการแก้ไขใน transaction เดียวกัน” ระหว่างหลาย table (เช่น posts + post_seller_accounts)
แล้วอธิบายวิธีใช้ให้ครับ

---

## แนวคิดสั้น ๆ

* เวลาแก้ `posts` + `post_seller_accounts` ในคำสั่งเดียวกัน (เช่นใน GraphQL mutation / service เดียว)
  → เราจะตั้งค่า GUC: `app.revision_group_id` ให้เป็น UUID เดียวกัน ก่อนยิง UPDATE/INSERT/DELETE
* trigger จะอ่าน `app.revision_group_id` แล้วบันทึกลง `*_revisions.revision_group_id`
* ทีนี้ถึงแม้

  * `posts_revisions` = 100 แถว
  * `post_seller_accounts_revisions` = 10 แถว
    ก็ยังสามารถ “จับคู่ตาม group เดียวกัน” ได้ เช่น
    `posts_revisions.revision_group_id = post_seller_accounts_revisions.revision_group_id`

---

## 🔧 Full Script (เวอร์ชัน Dev, รองรับ group / insert / update / delete)

```sql
-- ต้องเปิด uuid extension ถ้ายังไม่มี
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- 1. ฟังก์ชัน generic สำหรับบันทึก revision (ทุก table ใช้ร่วมกัน)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_generic_revision()
RETURNS trigger AS $$
DECLARE
  v_editor uuid;
  v_group uuid;
  v_rev_table text := TG_TABLE_NAME || '_revisions';
  v_exists bool;
  v_snapshot jsonb;
  v_fk uuid;  -- ค่า id ของ row ต้นฉบับ (สมมติทุก table ใช้ pk ชื่อ id)
BEGIN
  -- หา editor_id จาก session variable (GUC)
  BEGIN
    v_editor := NULLIF(current_setting('app.editor_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_editor := NULL;
  END;

  -- หา revision_group_id จาก session variable (GUC)
  BEGIN
    v_group := NULLIF(current_setting('app.revision_group_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_group := NULL;
  END;

  -- ตรวจว่าตาราง revision มีจริงไหม
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = v_rev_table
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE NOTICE 'Revision table % does not exist, skip insert', v_rev_table;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- เลือก snapshot / fk ตามประเภท operation
  IF TG_OP = 'INSERT' THEN
    v_snapshot := to_jsonb(NEW);
    v_fk := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- เก็บค่าเก่าก่อนอัปเดต
    v_snapshot := to_jsonb(OLD);
    v_fk := OLD.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_snapshot := to_jsonb(OLD);
    v_fk := OLD.id;
  ELSE
    -- เผื่อ case แปลก ๆ
    v_snapshot := NULL;
    v_fk := NULL;
  END IF;

  -- ถ้าไม่มี fk ก็ไม่ต้องบันทึกอะไร (กัน error)
  IF v_fk IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- บันทึก revision
  EXECUTE format(
    'INSERT INTO %I (id, %I_id, editor_id, revision_group_id, op, snapshot, created_at)
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, now())',
    v_rev_table, TG_TABLE_NAME
  )
  USING v_fk, v_editor, v_group, TG_OP, v_snapshot;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 2. ฟังก์ชันสำหรับสร้าง revision table + trigger อัตโนมัติให้แต่ละ table
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_revision_trigger(p_table text)
RETURNS void AS $$
DECLARE
  rev_table text := p_table || '_revisions';
  trg_name  text := p_table || '_rev_trg';
BEGIN
  -- 2.1 สร้าง revision table ถ้ายังไม่มี
  EXECUTE format($fmt$
    CREATE TABLE IF NOT EXISTS %I (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

      -- FK กลับไปยัง table ต้นฉบับ (สมมติ pk ชื่อ id และ type uuid)
      %I_id uuid REFERENCES %I(id) ON DELETE CASCADE,

      editor_id uuid,
      revision_group_id uuid,         -- 🆕 ใช้สำหรับจับชุด revision ข้ามหลาย table
      op text NOT NULL,               -- 'INSERT' | 'UPDATE' | 'DELETE'
      snapshot jsonb NOT NULL,
      created_at timestamptz DEFAULT now()
    )
  $fmt$, rev_table, p_table, p_table);

  -- 2.2 ลบ trigger เก่า (ถ้ามี) แล้วสร้างใหม่
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trg_name, p_table);

  EXECUTE format($fmt$
    CREATE TRIGGER %I
    BEFORE INSERT OR UPDATE OR DELETE ON %I
    FOR EACH ROW
    EXECUTE FUNCTION trg_generic_revision()
  $fmt$, trg_name, p_table);

  RAISE NOTICE '✅ Trigger created for table %', p_table;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 3. เรียกใช้ครั้งเดียวสำหรับ tables ที่ต้องการเก็บ revision
--------------------------------------------------------------------------------
-- posts
SELECT create_revision_trigger('posts');

-- users
SELECT create_revision_trigger('users');

-- post_seller_accounts
SELECT create_revision_trigger('post_seller_accounts');

-- post_tel_numbers
SELECT create_revision_trigger('post_tel_numbers');

-- ✅ เพิ่มตารางอื่นได้ในอนาคต เช่น
-- SELECT create_revision_trigger('products');
-- SELECT create_revision_trigger('drivers');
--------------------------------------------------------------------------------
```

---

## 🧪 How to use (ในขั้นตอน dev)

### 1) เมื่อมีการแก้ไขจากแอป → ตั้ง GUC ก่อนยิงคำสั่ง

สมมติใน GraphQL mutation / service layer ที่คุณควบคุมได้:

```sql
BEGIN;

-- 1. set editor_id (คนที่แก้)
SELECT set_config('app.editor_id', 'c6e0bb19-0d74-4c1f-bf9a-f8e7b4d7a999', true);

-- 2. set revision_group_id ให้ทั้งชุดใช้ id เดียวกัน
SELECT set_config('app.revision_group_id', uuid_generate_v4()::text, true);

-- 3. จากนั้นค่อยยิงคำสั่งแก้ไขจริง
UPDATE posts
SET title = 'New title', updated_at = now()
WHERE id = '...';

UPDATE post_seller_accounts
SET account_name = 'New Account'
WHERE post_id = '...';

COMMIT;
```

ผลลัพธ์:

* ใน `posts_revisions` จะมีแถวใหม่

  * `posts_id = ...`
  * `op = 'UPDATE'`
  * `revision_group_id = <ค่าเดียวกับใน set_config>`
* ใน `post_seller_accounts_revisions` ก็จะมีแถว

  * `post_seller_accounts_id = ...`
  * `op = 'UPDATE'`
  * `revision_group_id = <ค่าเดียวกัน>`

ถึงแม้จำนวน revision ของแต่ละ table จะไม่เท่ากัน ก็ยังรู้ได้ว่า
**“ชุดนี้” คือการแก้ไข posts + post_seller_accounts พร้อมกัน** ผ่าน `revision_group_id`

---

### 2) ตัวอย่างใช้ในโค้ด (Node / GraphQL แบบ pseudo)

```ts
// สมมติใช้ node-postgres / Prisma-like raw ฯลฯ
async function updatePostAndSellerAccount(db, editorId, postId, payload) {
  await db.tx(async (trx) => {
    // สร้าง group id 1 ตัวสำหรับทั้ง transaction นี้
    const { rows } = await trx.query(`SELECT uuid_generate_v4() AS id`);
    const groupId = rows[0].id;

    await trx.query(
      `SELECT set_config('app.editor_id', $1, true)`,
      [editorId]
    );
    await trx.query(
      `SELECT set_config('app.revision_group_id', $1, true)`,
      [groupId]
    );

    await trx.query(
      `UPDATE posts
       SET title = $1, content = $2, updated_at = now()
       WHERE id = $3`,
      [payload.title, payload.content, postId]
    );

    await trx.query(
      `UPDATE post_seller_accounts
       SET account_name = $1
       WHERE post_id = $2`,
      [payload.account_name, postId]
    );
  });
}
```

ฟังก์ชันนี้จะทำให้ revision ของทั้งสอง table มี `revision_group_id` เดียวกันโดยอัตโนมัติ

---

### 3) วิธี “จับคู่” revisions posts + post_seller_accounts

#### กรณีอยากดูเป็นคู่ตาม group

```sql
SELECT
  pr.id AS post_rev_id,
  pr.snapshot AS post_snapshot,
  sa_rev.id AS seller_rev_id,
  sa_rev.snapshot AS seller_snapshot,
  pr.revision_group_id,
  pr.created_at
FROM posts_revisions pr
LEFT JOIN post_seller_accounts_revisions sa_rev
       ON sa_rev.revision_group_id = pr.revision_group_id
WHERE pr.posts_id = '...'
ORDER BY pr.created_at;
```

* ถ้า group ไหนไม่มีการแก้ `post_seller_accounts`
  → `seller_rev_id` จะเป็น NULL แต่เราก็ยังรู้ว่าการแก้ posts ตัวนั้นเกิดเดี่ยว ๆ

#### กรณีอยากดู timeline ทั้งหมดของ post + seller_accounts

```sql
SELECT 'post' AS entity,
       pr.id,
       pr.op,
       pr.snapshot,
       pr.revision_group_id,
       pr.created_at
FROM posts_revisions pr
WHERE pr.posts_id = '...'

UNION ALL

SELECT 'seller' AS entity,
       sar.id,
       sar.op,
       sar.snapshot,
       sar.revision_group_id,
       sar.created_at
FROM post_seller_accounts_revisions sar
WHERE sar.post_seller_accounts_id IN (
  SELECT id FROM post_seller_accounts WHERE post_id = '...'
)
ORDER BY created_at;
```

อันนี้เหมาะสำหรับหน้า UI ที่โชว์ timeline รวมของ post + seller account ทุก event

---

## ตอบคำถามหลักแบบสั้น ๆ

> posts มี revision 100, post_seller_accounts มี revision 10
> จะ “รู้ว่าอันไหนคู่กัน” ยังไง?

* ให้ใช้ `revision_group_id` (มาจาก GUC `app.revision_group_id`) เป็น **ตัวผูกชุดการแก้ไขข้ามหลาย table**
* เวลา call service / mutation ที่แก้ posts + post_seller_accounts พร้อมกัน
  → ตั้ง `app.revision_group_id` ครั้งเดียวก่อนยิงคำสั่ง
* Trigger จะเก็บค่า group นั้นไว้ในทั้ง `posts_revisions` และ `post_seller_accounts_revisions`
* ทีนี้ก็สามารถ join กันด้วย `revision_group_id` ได้แม้จำนวน revision จะไม่เท่ากัน

ถ้าคุณอยาก ผมช่วยเขียนตัวอย่าง query / view สำหรับ UI “Revision Viewer” ให้ครบเลยก็ได้ เช่น

* select revision list ของ post
* diff snapshot ก่อน/หลัง
* แสดงข้อมูล seller account ที่ตรง revision เดียวกัน ฯลฯ




-----------------------------------------------------






ได้เลย เดี๋ยวผมปรับ helper ให้รองรับทั้ง `app.editor_id` และ `app.revision_group_id` ตามดีไซน์ด้านบนให้เลย 👇

หลัก ๆ คือ:

* ทุกครั้งที่เข้า `runInTransaction()`

  * เซ็ต `SET LOCAL app.editor_id = $1` จาก `userId`
  * สร้าง `revision_group_id` (UUID) ใหม่ใน Node แล้วเซ็ต `SET LOCAL app.revision_group_id = $1`
* trigger `trg_generic_revision()` ใน Postgres ก็จะอ่าน 2 GUC นี้ไปเขียนลง `*_revisions` ให้อัตโนมัติ

---

## 🔧 เวอร์ชันปรับแล้วของ `db.ts`

```ts
import { Pool, PoolClient, QueryResult } from "pg";
import { randomUUID } from "crypto";

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
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    // เปิด log ได้ถ้าต้องการดู SQL
    // console.log(
    //   `[SQL ${duration}ms]\n${text.trim()}\nParams: ${formatParams(params)}`
    // );

    return res;
  } catch (err: any) {
    console.error(
      `[SQL ERROR] ${err.message}\n${text.trim()}\nParams: ${formatParams(
        params
      )}`
    );
    throw err;
  }
}

/**
 * รันงานภายใน Transaction ให้หมดใน callback
 * - เริ่มด้วย BEGIN
 * - เซ็ต app.editor_id, app.revision_group_id (SET LOCAL)
 * - commit อัตโนมัติเมื่อ callback สำเร็จ
 * - rollback อัตโนมัติเมื่อ callback throw error
 * - ปล่อย client คืน pool เสมอ
 *
 * หมายเหตุ:
 * - userId ใช้สำหรับเก็บใน editor_id ของตาราง *_revisions
 * - revision_group_id จะถูกสร้างใหม่ทุกครั้งที่เรียกใช้ฟังก์ชันนี้
 *   เพื่อใช้จับกลุ่ม revision ของหลาย table ที่แก้ใน transaction เดียวกัน
 */
export async function runInTransaction<T>(
  userId: string,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) ตั้งค่า editor_id (ถ้าไม่มี ให้เป็น string ว่าง)
    if (userId) {
      await client.query("SET LOCAL app.editor_id = $1", [userId]);
    } else {
      await client.query("SET LOCAL app.editor_id = ''");
    }

    // 2) สร้าง revision_group_id ใหม่ทุก transaction
    const revisionGroupId = randomUUID();
    await client.query("SET LOCAL app.revision_group_id = $1", [
      revisionGroupId,
    ]);

    // ถ้าอยาก debug group id:
    // console.log("[REVISION GROUP]", revisionGroupId);

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
ตัวอย่างการใช้งาน:

import { runInTransaction } from "@/lib/db";

const userId = "c6e0bb19-0d74-4c1f-bf9a-f8e7b4d7a999"; // uuid ของ user ปัจจุบัน

await runInTransaction(userId, async (client) => {
  // อันนี้จะอยู่ใน BEGIN / COMMIT เดียวกัน
  // และ trigger revision จะได้ทั้ง app.editor_id + app.revision_group_id

  const { rows } = await client.query(
    "INSERT INTO posts (title, body) VALUES ($1,$2) RETURNING id",
    ["hello", "world"]
  );
  const postId = rows[0].id;

  // สมมติมี table post_seller_accounts ที่ link กับ post นี้
  await client.query(
    "INSERT INTO post_seller_accounts (post_id, account_name) VALUES ($1,$2)",
    [postId, "My Seller"]
  );

  // เมื่อ trigger ทำงาน:
  // - posts_revisions และ post_seller_accounts_revisions
  //   จะได้ revision_group_id เดียวกันในทุกแถวที่เกิดจาก transaction นี้
  // - editor_id จะเป็น userId ที่เราใส่เข้าไป

  return postId;
});

*/
```

---

## ✅ How to use ให้ครบ flow (DB + Node)

1. **ฝั่ง DB (ทำไปแล้ว)**

   * มีฟังก์ชัน `trg_generic_revision()` ที่อ่าน

     * `current_setting('app.editor_id', true)`
     * `current_setting('app.revision_group_id', true)`
   * มี `create_revision_trigger('posts')`, `create_revision_trigger('post_seller_accounts')` ฯลฯ
   * แต่ละ `*_revisions` มีคอลัมน์ `editor_id`, `revision_group_id`, `op`, `snapshot`, `created_at`

2. **ฝั่ง Node / GraphQL / Service**

   * ทุก mutation ที่คุณอยากให้เก็บ revision time-travel แบบ group ให้ใช้ `runInTransaction(userId, cb)`
   * ใน callback (`cb`) ให้ใช้ `client.query()` แทน `query()` ปกติทั้งหมด

   ตัวอย่าง:

   ```ts
   await runInTransaction(currentUser.id, async (client) => {
     await client.query(
       "UPDATE posts SET title = $1 WHERE id = $2",
       [input.title, input.postId]
     );

     await client.query(
       "UPDATE post_seller_accounts SET account_name = $1 WHERE post_id = $2",
       [input.accountName, input.postId]
     );
   });
   ```

   แค่ทำแบบนี้:

   * trigger จะสร้างแถวใน `posts_revisions` และ `post_seller_accounts_revisions`
   * ทั้งคู่อยู่ใน `revision_group_id` เดียวกัน
   * ใช้ join ย้อนหลังเพื่อดูว่า **post revision ไหน** จับคู่กับ **seller_accounts revision ไหน** ได้เลย เช่น:

   ```sql
   SELECT
     pr.id AS post_revision_id,
     pr.snapshot AS post_snapshot,
     sar.id AS seller_revision_id,
     sar.snapshot AS seller_snapshot,
     pr.revision_group_id,
     pr.created_at
   FROM posts_revisions pr
   LEFT JOIN post_seller_accounts_revisions sar
          ON sar.revision_group_id = pr.revision_group_id
   WHERE pr.posts_id = $1
   ORDER BY pr.created_at;
   ```

---

ถ้าคุณอยากให้ `runInTransaction` ส่ง `revision_group_id` กลับเข้า callback ด้วย (เผื่อจะเอาไป log หรือใช้ต่ออย่างอื่น) ผมก็ปรับเพิ่ม parameter ที่สองใน callback ให้ได้เหมือน:

```ts
runInTransaction(userId, async (client, ctx) => {
  console.log(ctx.revisionGroupId);
});
```

บอกได้เลยว่าชอบแบบไหน เดี๋ยวผมเขียนเวอร์ชันนั้นให้ต่อได้เลย 😄




--------------------------------------------------



โอเค เคสนี้น่าสนุกมาก 👍

**บริบทสั้น ๆ**

* `post` มี `bank_id` FK ไป `bank`
* คุณมี

  * `post_revision(id, json)`
  * `bank_revision(id, json)`
* คำถาม: เวลา “ย้อนดูอดีต” หรือ “tag ย้อนหลัง” ให้รู้ว่า post_revision ตัวนี้ควรใช้ bank_revision ตัวไหน ทำยังไงดี?

ผมแยกเป็น 2 part:

1. ออกแบบสำหรับ “อนาคต” ให้มัน work ดีตั้งแต่แรก
2. เคส “ย้อนหลัง” ที่ของเก่าทำไปแล้ว อยากมา map ทีหลัง

---

## 1. ออกแบบ revision ให้ “รู้กันทั้งระบบ” (ทางยาว แต่สบายทีหลัง)

แนวคิดคือทำ **Global Revision / Version** เหมือน time-travel:

### โครงสร้างตัวอย่าง

```sql
-- running number ทั่วระบบ
revision_seq BIGSERIAL PK;  -- 1,2,3,4,...

post_revision
- id
- post_id
- revision_seq  -- ใช้ตัวเดียวกันกับรอบที่แก้
- snapshot jsonb  -- เก็บ field ของ post รวมทั้ง bank_id ตอนนั้น
- created_at

bank_revision
- id
- bank_id
- revision_seq  -- ใช้ตัวเดียวกันถ้าเป็นการแก้ใน transaction เดียวกัน
- snapshot jsonb
- created_at
```

**เวลามีการแก้ post + bank พร้อมกันในจังหวะเดียวกัน**

* สร้าง `revision_seq` ใหม่ (เช่น 50)
* insert row ลง `post_revision` (revision_seq = 50)
* insert row ลง `bank_revision` ที่เกี่ยวข้อง (revision_seq = 50)

**เวลาอยากย้อนกลับไปดู post revision ตัวนึง**
สมมติมี row ใน `post_revision`:

```text
post_revision.id = 123
post_id = 10
revision_seq = 50
snapshot.bank_id = 7
```

คุณอยากรู้ว่า `bank_revision` ที่ควรใช้คืออันไหน → Query แบบนี้:

```sql
SELECT *
FROM bank_revision
WHERE bank_id = 7
  AND revision_seq <= 50
ORDER BY revision_seq DESC
LIMIT 1;
```

คือ **เอา revision ของ bank ล่าสุดที่ “ไม่เกิน” revision ของ post**
เหมือนการ time-travel ด้วยจุดอ้างอิงเดียว (`revision_seq`)

> ถ้าไม่อยากมี global seq จะใช้ `created_at` ก็ได้ แต่เสี่ยงเจอ concurrent + clock ไม่เป๊ะ

---

## 2. เคส “tag ย้อนหลัง” เมื่อของมันถูกสร้างไปแล้ว

สมมติระบบเดิมมีแค่:

```sql
post_revision(id, post_id, snapshot, created_at)
bank_revision(id, bank_id, snapshot, created_at)
```

และตอนสร้าง revision **ไม่ได้เก็บความสัมพันธ์ไว้เลย**
ตอนนี้คุณอยากมานั่ง tag ว่า:

> post_revision #123 → ใช้คู่กับ bank_revision #9

วิธีที่ปลอดภัยสุดคือเพิ่ม **ตาราง link สำหรับ mapping ย้อนหลัง**:

```sql
post_bank_revision
- id
- post_revision_id  (FK -> post_revision.id)
- bank_revision_id  (FK -> bank_revision.id)
- tagged_by
- tagged_at
- note
```

### Flow ใช้งาน

1. ทำหน้า admin ให้คนเลือก:

   * เลือก `post_revision` (เช่น id = 123)
   * เลือก `bank_revision` ที่ต้องการผูก (เช่น id = 9)
2. บันทึกลง `post_bank_revision`

```sql
INSERT INTO post_bank_revision(post_revision_id, bank_revision_id, tagged_by, tagged_at)
VALUES (123, 9, 'admin', now());
```

3. เวลาแสดง timeline / ดู revision:

   * เลือก `post_revision` ที่ต้องการ
   * `LEFT JOIN` ไป `post_bank_revision` → `bank_revision`

ตัวอย่าง query:

```sql
SELECT
  pr.id AS post_revision_id,
  pr.snapshot AS post_snapshot,
  br.id AS bank_revision_id,
  br.snapshot AS bank_snapshot
FROM post_revision pr
LEFT JOIN post_bank_revision pbr
  ON pbr.post_revision_id = pr.id
LEFT JOIN bank_revision br
  ON br.id = pbr.bank_revision_id
WHERE pr.id = 123;
```

* ถ้า **มี mapping** → ใช้ `bank_revision` ตามที่ tag
* ถ้า **ยังไม่มี mapping** → คุณจะ fallback ด้วย rule เวลาตาม `created_at` ก็ได้ เช่น

```sql
SELECT *
FROM bank_revision
WHERE bank_id = (pr.snapshot->>'bank_id')::int
  AND created_at <= pr.created_at
ORDER BY created_at DESC
LIMIT 1;
```

แล้ว show ว่าเป็น “auto-match” ให้ user กด confirm → insert mapping ซ้ำลง `post_bank_revision` ทีหลัง (กลายเป็น manual tag)

---

## 3. อีก approach ง่ายสุด (แต่ denormalize หน่อย)

ถ้าไม่หวง normalize มาก ก็ใช้วิธี:

* เมื่อสร้าง `post_revision` ให้ **embed ข้อมูล bank ตอนนั้นลงใน snapshot เลย** เช่น:

```json
{
  "title": "My post",
  "bank_id": 7,
  "bank_snapshot": {
    "name": "K-Bank",
    "branch": "Silom",
    "account_number_masked": "xxx-xxx-1234"
  }
}
```

ข้อดี:

* เวลา “ย้อนอดีต” ใช้ `post_revision.snapshot.bank_snapshot` อย่างเดียว ไม่ต้อง join อะไรทั้งนั้น
* ง่ายสุด เร็วสุด

ข้อเสีย:

* ข้อมูลซ้ำในหลาย revision
* ถ้ามี logic ต้องดูเฉพาะ bank revision (เช่น audit แยกของ bank) จะยุ่งขึ้น

---

## สรุปแนวทางแนะนำ

ถ้าให้เลือก:

* ถ้าเน้น **ง่าย + ใช้เฉพาะ UI ย้อนดู** →
  ➜ ใส่ `bank_snapshot` ลง `post_revision` เลย จบง่ายสุด

* ถ้าต้องการ **time-travel ทั้งระบบ + audit สวย ๆ** →
  ➜ ทำ `revision_seq` (global) แล้วใช้ pattern `revision_seq <= X ORDER BY revision_seq DESC`

* ถ้าตอนนี้ของสร้างไปแล้ว และอยาก **“tag ย้อนหลัง”** →
  ➜ เพิ่มตาราง `post_bank_revision` เพื่อ map `post_revision` ↔ `bank_revision`

ถ้าคุณบอก structure จริง (Postgres JSONB / trigger ที่มีอยู่แล้ว) ผมช่วยออกแบบ trigger + query แบบเต็มให้ได้เลย รวมถึง UI flow (เช่น modal ให้เลือก revision ของ bank มา tag กับ post) 😄





-------------------------------------------------------







ตอนนี้โครงที่คุณมีคือ **revision แยก table** (`posts_revisions`, `post_seller_accounts_revisions`, …) แต่ไม่มี “ตัวกลาง” บอกว่า

> ตอนที่ได้ revision #x ของ `posts` → อยู่ใน state เดียวกับ revision ไหนของ `post_seller_accounts`?

เลยเกิดเคสที่คุณถามได้ว่า:
`post_seller_accounts` มีแค่ 10 revisions แต่ `posts` มี 100
งั้นเวลาเราไปดู `posts_revisions.id = 87` จะรู้ได้ไงว่าควรใช้ `post_seller_accounts_revisions` ตัวไหน

---

## แนวคิดที่แนะนำ: ทำ “global revision key” ให้ทุก revision

แนวทางที่เข้ากับฟังก์ชันที่คุณมีตอนนี้สุด ๆ คือ เพิ่ม column สำหรับ **global revision / txid** ลงในทุก ๆ `_revisions` แล้วให้ trigger บันทึกค่าเดียวกันทุก table ใน transaction เดียวกัน

ง่ายสุดคือใช้ `txid_current()` (transaction ID ของ Postgres) เลย:

* ทุก statement ที่อยู่ใน transaction เดียวกัน → ได้เลข `txid_current()` เดียวกัน
* ใช้เป็น “time-travel key” ข้ามหลาย table ได้

### 1) ปรับ schema ของ revision table

แก้ `create_revision_trigger` ให้สร้าง column เพิ่ม เช่น `txid bigint`:

```sql
CREATE OR REPLACE FUNCTION create_revision_trigger(p_table text)
RETURNS void AS $$
DECLARE
  rev_table text := p_table || '_revisions';
  trg_name  text := p_table || '_rev_trg';
BEGIN
  -- 2.1 สร้าง revision table ถ้ายังไม่มี
  EXECUTE format($fmt$
    CREATE TABLE IF NOT EXISTS %I (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      %I_id uuid REFERENCES %I(id) ON DELETE CASCADE,
      editor_id uuid,
      snapshot jsonb NOT NULL,
      created_at timestamptz DEFAULT now(),
      txid bigint NOT NULL DEFAULT txid_current()   -- ⭐ เพิ่มตรงนี้
    )$fmt$, rev_table, p_table, p_table);

  -- 2.2 ลบ trigger เก่า (ถ้ามี) แล้วสร้างใหม่
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trg_name, p_table);
  EXECUTE format($fmt$
    CREATE TRIGGER %I
    BEFORE UPDATE ON %I
    FOR EACH ROW
    EXECUTE FUNCTION trg_generic_revision()
  $fmt$, trg_name, p_table);

  RAISE NOTICE '✅ Trigger created for table %', p_table;
END;
$$ LANGUAGE plpgsql;
```

ถ้าตาราง `_revisions` เท่าที่มีอยู่แล้วสร้างไปก่อนหน้าแล้ว
ให้ `ALTER TABLE` เพิ่ม column นี้ทีหลังได้ เช่น:

```sql
ALTER TABLE posts_revisions
  ADD COLUMN IF NOT EXISTS txid bigint NOT NULL DEFAULT txid_current();

ALTER TABLE post_seller_accounts_revisions
  ADD COLUMN IF NOT EXISTS txid bigint NOT NULL DEFAULT txid_current();
```

> ถ้าอยากให้สวย ๆ แนะนำสร้าง index:
> `CREATE INDEX ON posts_revisions (post_id, txid);`
> `CREATE INDEX ON post_seller_accounts_revisions (post_seller_account_id, txid);`

---

### 2) ปรับ trigger ให้บันทึก `txid_current()` ลงไป

แก้ `trg_generic_revision` ให้ insert `txid` ด้วย:

```sql
CREATE OR REPLACE FUNCTION trg_generic_revision()
RETURNS trigger AS $$
DECLARE
  v_editor uuid;
  v_rev_table text := TG_TABLE_NAME || '_revisions';
  v_exists bool;
BEGIN
  -- หา editor_id จาก session variable (GUC)
  BEGIN
    v_editor := NULLIF(current_setting('app.editor_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_editor := NULL;
  END;

  -- ตรวจว่าตาราง revision มีจริงไหม
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_name = v_rev_table
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE NOTICE 'Revision table % does not exist, skip insert', v_rev_table;
    RETURN NEW;
  END IF;

  -- บันทึก snapshot เก่า
  IF TG_OP = 'UPDATE' THEN
    EXECUTE format(
      'INSERT INTO %I (id, %I_id, editor_id, snapshot, created_at, txid)
       VALUES (uuid_generate_v4(), $1, $2, row_to_json($3), now(), txid_current())',
      v_rev_table, TG_TABLE_NAME
    )
    USING OLD.id, v_editor, OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

ตอนนี้ทุกครั้งที่เกิด revision ใด ๆ:

* `posts_revisions.txid` = `txid_current()`
* `post_seller_accounts_revisions.txid` = `txid_current()`
* ถ้ามันเกิดจาก **query ใน transaction เดียวกัน** (เช่น update post + update post_seller_accounts ภายใน 1 mutation) → จะได้ `txid` เดียวกัน

---

## 3) เวลา “ย้อนดู” post revision → เลือก post_seller_accounts revision ยังไง

สมมติ:

* คุณเปิด `posts_revisions` ขึ้นมาที่ row:

```text
posts_revisions.id       = 'aaa-bbb'
posts_revisions.post_id  = 'P1'
posts_revisions.txid     = 5000
posts_revisions.snapshot = { ... }
```

คุณอยากได้ state ของ `post_seller_accounts` ที่ “ใกล้เคียงอดีตตอนนั้นที่สุด แต่ไม่เกินนั้น”

เช่น มีความสัมพันธ์แบบ:

* `post_seller_accounts` มีหลาย row (1 post : N accounts)
* แต่ละ row มี `_revisions` ของตัวเอง

ตัวอย่าง query (แบบใช้ `LATERAL`) หา revision ล่าสุดของแต่ละ account ที่ `txid <= 5000`:

```sql
-- เอา accounts ปัจจุบันที่ post นี้ใช้ก่อน
WITH current_accounts AS (
  SELECT psa.id
  FROM post_seller_accounts psa
  WHERE psa.post_id = 'P1'
)
SELECT
  ca.id AS post_seller_account_id,
  r.id  AS revision_id,
  r.snapshot,
  r.txid,
  r.created_at
FROM current_accounts ca
CROSS JOIN LATERAL (
  SELECT *
  FROM post_seller_accounts_revisions r
  WHERE r.post_seller_accounts_id = ca.id
    AND r.txid <= 5000          -- ⭐ ไม่เกิน txid ของ post_revision
  ORDER BY r.txid DESC
  LIMIT 1
) r;
```

หรือถ้าคุณเก็บ `post_id` ใน `snapshot` แล้วอยากหาแบบตรง ๆ ก็ได้เช่นกัน (ขึ้นกับโครงจริงของคุณ)

### ทำไมต้อง `<= txid` ไม่ใช่ `=` เฉย ๆ?

เพราะ:

* บาง revision ของ `posts` อาจไม่ได้แก้อะไรใน `post_seller_accounts` → จะไม่มี row `_revisions` ที่ `txid = 5000`
* พอไม่มี ให้ถอยกลับไปใช้ revision ที่ **ล่าสุดก่อนหน้า** → นั่นคือ `txid <= 5000 ORDER BY txid DESC LIMIT 1`

เลยได้ behavior แบบ time-travel ถูกต้อง:

> “ดู post ณ จุด txid นี้ → ใช้ child account state ล่าสุดก่อนหรือใน txid นี้”

---

## 4) ตอบคำถามตรง ๆ ของคุณ

> กรณี อาจเป็นไปได้ ว่า `post_seller_accounts` มี revision แค่ 10 แต่ `posts` อาจมี revision 100 อันนี้จะแก้ check ยังไงว่า post นี้ กับ post_seller_accounts อันไหน

คำตอบแบบ design:

1. **เพิ่ม column global key (เช่น `txid` หรือ `revision_seq`) ในทุก `_revisions`**
2. ให้ trigger บันทึก key เดียวกันทุก table ใน transaction เดียวกัน (`txid_current()` ง่ายสุด)
3. เวลาเรียกดู:

   * เอา `txid` ของ `posts_revisions` ที่เราเลือก
   * หา `post_seller_accounts_revisions` ที่ `txid <= post_txid` และเลือกอันที่ `txid` สูงสุด (ล่าสุดก่อนหรือเท่ากับ)

แบบนี้ไม่สำคัญเลยว่าจำนวน revision จะไม่เท่ากัน 10 vs 100 เพราะเราใช้ “แกนเวลาเดียวกัน” แทนจำนวนครั้งของแต่ละ table

---

ถ้าคุณเลย์เอาต์ความสัมพันธ์จริง (posts ↔ post_seller_accounts) มาให้สักนิด ผมช่วยเขียน query แบบเต็ม ๆ พร้อมตัวอย่าง schema จริง + ตัวอย่าง view “ดู revision ทั้งชุด” (post + seller_accounts + tel_numbers) ให้ได้เลยครับ 💪

