ได้เลย จัดรุ่นโปรให้แบบ “Google mini version” เลย ทั้ง full-text, trigram, weight, ranking 🔥

ผมจะแบ่งเป็น 2 ส่วน:

1. SQL ที่ต้องรันใน Postgres (extension + index + config แนะนำ)
2. globalSearch resolver เวอร์ชันใช้ `to_tsvector` + `pg_trgm` + weight + score

---

## 1) SQL Setup – เปิดของแรงใน Postgres

รันพวกนี้ใน DB (ครั้งเดียว)

```sql
-- ===========================
-- 1) EXTENSIONS
-- ===========================
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- =====================================================
-- 2) POSTS — columns + trigger + indexes (detail instead of body)
-- =====================================================

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS title_unaccent  text,
ADD COLUMN IF NOT EXISTS detail_unaccent text;

CREATE OR REPLACE FUNCTION trg_posts_unaccent()
RETURNS trigger AS $$
BEGIN
  NEW.title_unaccent  := unaccent(coalesce(NEW.title,  ''));
  NEW.detail_unaccent := unaccent(coalesce(NEW.detail, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posts_unaccent_insupd ON posts;

CREATE TRIGGER trg_posts_unaccent_insupd
BEFORE INSERT OR UPDATE OF title, detail ON posts
FOR EACH ROW EXECUTE FUNCTION trg_posts_unaccent();

-- full-text index (title A, detail C)
CREATE INDEX IF NOT EXISTS idx_posts_search_tsv
ON posts
USING GIN (
  tsvector_concat(
    setweight(to_tsvector('simple', coalesce(title_unaccent,  '')), 'A'),
    setweight(to_tsvector('simple', coalesce(detail_unaccent, '')), 'C')
  )
);

-- trigram index
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm
ON posts
USING GIN (title_unaccent gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posts_detail_trgm
ON posts
USING GIN (detail_unaccent gin_trgm_ops);

-- =================================================
-- 3) USERS — columns + trigger + indexes
-- =================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS name_unaccent  text,
ADD COLUMN IF NOT EXISTS email_unaccent text;

CREATE OR REPLACE FUNCTION trg_users_unaccent()
RETURNS trigger AS $$
BEGIN
  NEW.name_unaccent  := unaccent(coalesce(NEW.name,  ''));
  NEW.email_unaccent := unaccent(coalesce(NEW.email, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_unaccent_insupd ON users;

CREATE TRIGGER trg_users_unaccent_insupd
BEFORE INSERT OR UPDATE OF name, email ON users
FOR EACH ROW EXECUTE FUNCTION trg_users_unaccent();

CREATE INDEX IF NOT EXISTS idx_users_search_tsv
ON users
USING GIN (
  tsvector_concat(
    setweight(to_tsvector('simple', coalesce(name_unaccent,  '')), 'A'),
    setweight(to_tsvector('simple', coalesce(email_unaccent, '')), 'B')
  )
);

CREATE INDEX IF NOT EXISTS idx_users_name_trgm
ON users
USING GIN (name_unaccent gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_email_trgm
ON users
USING GIN (email_unaccent gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_phone_trgm
ON users
USING GIN (phone gin_trgm_ops);

-- =========================================================
-- 4) POST_TEL_NUMBERS — trigram index (เบอร์)
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_post_tel_numbers_phone_trgm
ON post_tel_numbers
USING GIN (tel gin_trgm_ops);

-- ===========================================================
-- 5) POST_SELLER_ACCOUNTS — columns + trigger + indexes
-- ===========================================================

ALTER TABLE post_seller_accounts
ADD COLUMN IF NOT EXISTS account_unaccent text,
ADD COLUMN IF NOT EXISTS bank_unaccent    text;

CREATE OR REPLACE FUNCTION trg_post_seller_accounts_unaccent()
RETURNS trigger AS $$
BEGIN
  NEW.account_unaccent := unaccent(coalesce(NEW.seller_account, ''));
  NEW.bank_unaccent    := unaccent(coalesce(NEW.bank_name,      ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_seller_accounts_unaccent_insupd
  ON post_seller_accounts;

CREATE TRIGGER trg_post_seller_accounts_unaccent_insupd
BEFORE INSERT OR UPDATE OF seller_account, bank_name
ON post_seller_accounts
FOR EACH ROW EXECUTE FUNCTION trg_post_seller_accounts_unaccent();

CREATE INDEX IF NOT EXISTS idx_post_seller_accounts_acc_trgm
ON post_seller_accounts
USING GIN (account_unaccent gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_post_seller_accounts_bank_trgm
ON post_seller_accounts
USING GIN (bank_unaccent gin_trgm_ops);

-- ===========================================================
-- 6) BACKFILL ค่า unaccent สำหรับ row เก่า
-- ===========================================================

UPDATE posts SET title = title;
UPDATE users SET name = name;
UPDATE post_seller_accounts
SET bank_name = bank_name, seller_account = seller_account;

```

> ใช้ `'simple'` config + `unaccent` ทำให้ค้นหาแบบไม่ติดวรรณยุกต์/ตัวเล็กใหญ่ และ trigram จะไวขึ้นเพราะมี GIN index

---

## 2) Resolver: `globalSearch` เวอร์ชันโหด

ใช้ `import { query } from "@/lib/db";` + ranking แบบ:

* **Posts**

  * Title: weight A (3 แต้ม)
  * Body: weight C (1 แต้ม)
  * ts_rank + similarity(title/body) + created_at
* **Users**

  * Name: weight A
  * Email: weight B
  * similarity(email, term) / phone trigram
* **Phones / Bank Accounts**

  * trigram similarity + report_count (accounts / phones ที่โดน report เยอะจะดันขึ้น)

```ts
import { query } from "@/lib/db";
// แก้ path requireAuth ให้ตรงโปรเจ็กต์จริงของคุณ
import { requireAuth } from "@/lib/auth"; 

function buildLike(term: string) {
  // escape % และ _ กัน LIKE แตก
  return `%${term.replace(/[%_]/g, (m) => "\\" + m)}%`;
}

export const resolvers = {
  Query: {
    globalSearch: async (_: any, { q }: { q: string }, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] globalSearch (pro) :", author_id, q);

      const term = (q || "").trim();
      if (!term) {
        return { posts: [], users: [], phones: [], bank_accounts: [] };
      }

      const like = buildLike(term);
      const useTrgm = term.length >= 3;

      // ============================
      // 1) POSTS (posts + title/detail_unaccent)
      // ============================
      const postsPromise = query(
        `
        SELECT
          s.id,
          s.title,
          s.snippet,
          s.created_at
        FROM (
          SELECT
            p.id,
            p.title,
            p.detail AS snippet,
            p.created_at,

            -- full-text rank (title A, detail C)
            ts_rank(
              tsvector_concat(
                setweight(to_tsvector('simple', coalesce(p.title_unaccent,  '')), 'A'),
                setweight(to_tsvector('simple', coalesce(p.detail_unaccent, '')), 'C')
              ),
              plainto_tsquery('simple', unaccent($1))
            ) AS ft_rank,

            -- trigram similarity
            GREATEST(
              similarity(coalesce(p.title_unaccent,  ''), unaccent($1)),
              similarity(coalesce(p.detail_unaccent, ''), unaccent($1))
            ) AS sim
          FROM posts p
          WHERE
                tsvector_concat(
                  setweight(to_tsvector('simple', coalesce(p.title_unaccent,  '')), 'A'),
                  setweight(to_tsvector('simple', coalesce(p.detail_unaccent, '')), 'C')
                ) @@ plainto_tsquery('simple', unaccent($1))
             OR p.title_unaccent  ILIKE unaccent($2)
             OR p.detail_unaccent ILIKE unaccent($2)
             -- เผื่อ row เก่าที่ยังไม่ได้ backfill
             OR p.title  ILIKE $2
             OR p.detail ILIKE $2
        ) AS s
        ORDER BY
          (s.ft_rank * 2.0 + s.sim * 5.0) DESC,
          s.created_at DESC
        LIMIT 20
        `,
        [term, like]
      );

      // ============================
      // 2) USERS (users + name/email_unaccent)
      // ============================
      const usersPromise = query(
        `
        SELECT
          s.id,
          s.name,
          s.email,
          s.phone,
          s.avatar
        FROM (
          SELECT
            u.id,
            u.name,
            u.email,
            u.phone,
            u.avatar,

            ts_rank(
              tsvector_concat(
                setweight(to_tsvector('simple', coalesce(u.name_unaccent,  '')), 'A'),
                setweight(to_tsvector('simple', coalesce(u.email_unaccent, '')), 'B')
              ),
              plainto_tsquery('simple', unaccent($1))
            ) AS ft_rank,

            GREATEST(
              similarity(coalesce(u.email_unaccent, ''), unaccent($1)),
              similarity(coalesce(u.phone,          ''), $1)
            ) AS sim
          FROM users u
          WHERE
                tsvector_concat(
                  setweight(to_tsvector('simple', coalesce(u.name_unaccent,  '')), 'A'),
                  setweight(to_tsvector('simple', coalesce(u.email_unaccent, '')), 'B')
                ) @@ plainto_tsquery('simple', unaccent($1))
             OR u.name_unaccent  ILIKE unaccent($2)
             OR u.email_unaccent ILIKE unaccent($2)
             OR u.phone ILIKE $2
        ) AS s
        ORDER BY
          (s.ft_rank * 2.5 + s.sim * 4.0) DESC
        LIMIT 20
        `,
        [term, like]
      );

      // ============================
      // 3) PHONES = post_tel_numbers
      // ============================

      const phonesSql = `
        SELECT
          MIN(id::text) AS id,
          tel          AS phone,
          COUNT(*)     AS report_count,
          MAX(created_at) AS last_report_at
        FROM post_tel_numbers
        WHERE
          ${useTrgm ? "tel % $1" : "tel ILIKE $1"}
        GROUP BY tel
        ORDER BY
          report_count DESC,
          last_report_at DESC
        LIMIT 20
      `;

      const phonesParams = [useTrgm ? term : like];

      const phonesPromise = query(phonesSql, phonesParams);

      // ============================
      // 4) BANK ACCOUNTS = post_seller_accounts
      // ============================

      const banksSql = `
        SELECT
          MIN(id::text) AS id,
          bank_name,
          seller_account,
          COUNT(*)        AS report_count,
          MAX(created_at) AS last_report_at
        FROM post_seller_accounts
        WHERE
          ${
            useTrgm
              ? "(account_unaccent % unaccent($1) OR bank_unaccent % unaccent($1))"
              : "(account_unaccent ILIKE unaccent($1) OR bank_unaccent ILIKE unaccent($1))"
          }
        GROUP BY bank_name, seller_account
        ORDER BY
          report_count DESC,
          last_report_at DESC
        LIMIT 20
      `;

      const banksParams = [useTrgm ? term : like];

      const banksPromise = query(banksSql, banksParams);

      // run พร้อมกัน
      const [postsRes, usersRes, phonesRes, banksRes] = await Promise.all([
        postsPromise,
        usersPromise,
        phonesPromise,
        banksPromise,
      ]);

      const posts = postsRes.rows.map((row: any) => ({
        id: row.id,
        entity_id: row.id,
        title: row.title,
        snippet: row.snippet,
        created_at: row.created_at,
      }));

      const users = usersRes.rows.map((row: any) => ({
        id: row.id,
        entity_id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        avatar: row.avatar,
      }));

      const phones = phonesRes.rows.map((row: any) => ({
        id: row.id,
        entity_id: row.id,
        phone: row.phone,
        report_count: row.report_count,
        last_report_at: row.last_report_at,
      }));

      const bank_accounts = banksRes.rows.map((row: any) => ({
        id: row.id,
        entity_id: row.id,
        bank_name: row.bank_name,
        account_no_masked: row.seller_account,
        report_count: row.report_count,
        last_report_at: row.last_report_at,
      }));

      return { posts, users, phones, bank_accounts };
    },
  },
};

```

---

### สรุปสไตล์นี้มันทำอะไรให้คุณบ้าง

* พิมพ์คำค้นทีเดียว → ได้ผลลัพธ์สี่ก้อน (post / user / phone / bank account)
* Post + User ใช้ full-text + trigram + weight title/email สูง
* Phone/Bank เน้น similarity + จำนวน report ช่วยจัดอันดับ
* รองรับการพิมพ์แบบไม่ตรงเป๊ะ (สะกดคลาดนิดหน่อยก็ยังเจอจาก trigram)
* แถวแรก ๆ จะเป็น

  * ชื่อ/หัวข้อที่ตรงเป๊ะ หรือใกล้เคียงมาก
  * เบอร์/บัญชีที่โดน report หนัก ๆ

ถ้าอยากขั้นกว่าอีก เช่น

* ทำ “suggestion / autocomplete” แยกอีก query
* ทำ “did you mean” จาก trigram
* หรือเก็บ search_log เพื่อแสดง popular search ใน dropdown ประวัติ

ผมต่อยอดให้ได้อีกชั้นแบบไม่ต้องถามเหมือนกัน 😈
