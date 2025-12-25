ได้ครับ — แนวทาง “เก็บ Template ใน PostgreSQL” ที่ใช้งานจริงคือ:

* เก็บ **subject / html / text** ใน DB
* เวลาเรียกส่งอีเมล → ดึง template ตาม `key + locale` → **render ตัวแปร** (เช่น `{{user_name}}`, `{{verify_url}}`) → ส่งผ่าน SendGrid
* รองรับ **versioning + publish/unpublish** ได้ง่าย

ด้านล่างเป็น **Full code ตัวอย่าง** (เอา template Register + Forgot Password ที่ให้ไว้ก่อนหน้าไปใส่ใน DB)

---

# 1) PostgreSQL Schema + Seed Data

## 1.1 ตาราง `email_templates`

```sql
-- 001_create_email_templates.sql
CREATE TABLE IF NOT EXISTS email_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL,              -- e.g. "auth.verify", "auth.reset"
  locale        TEXT NOT NULL DEFAULT 'en', -- e.g. "en", "th"
  version       INT  NOT NULL DEFAULT 1,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,

  subject_tpl   TEXT NOT NULL,              -- handlebars template
  html_tpl      TEXT NOT NULL,              -- handlebars template
  text_tpl      TEXT,                       -- optional

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(key, locale, version)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_templates_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ช่วยให้ query เร็ว
CREATE INDEX IF NOT EXISTS idx_email_templates_lookup
ON email_templates (key, locale, is_active, is_published, version DESC);
```

> ต้องมี `pgcrypto` เพื่อใช้ `gen_random_uuid()`

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## 1.2 Seed ตัวอย่าง Templates (Register + Forgot)

> ใส่ “ตัวอย่าง template ด้านบน” ลงไปตรง ๆ (ผมย่อ/คงเดิมตามที่ส่งไว้)

```sql
-- 002_seed_email_templates.sql

-- Register / Verify
INSERT INTO email_templates
(key, locale, version, is_active, is_published, subject_tpl, html_tpl, text_tpl)
VALUES
(
  'auth.verify',
  'en',
  1,
  TRUE,
  TRUE,
  'Verify your email - {{app_name}}',
  $HTML$
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Verify your email</title>
    <style>
      body { margin:0; padding:0; background:#f6f7fb; font-family: Arial, Helvetica, sans-serif; color:#111827; }
      .wrap { width:100%; padding:24px 12px; }
      .card { max-width:560px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 22px rgba(0,0,0,0.06); }
      .header { padding:18px 22px; background:#111827; color:#ffffff; }
      .content { padding:22px; line-height:1.55; }
      .btn { display:inline-block; padding:12px 16px; border-radius:10px; background:#2563eb; color:#ffffff !important; text-decoration:none; font-weight:700; }
      .muted { color:#6b7280; font-size:13px; }
      .hr { height:1px; background:#eef2f7; margin:18px 0; }
      .code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background:#f3f4f6; padding:10px 12px; border-radius:10px; word-break:break-all; }
      @media (max-width: 480px) { .header, .content { padding:16px; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="header">
          <div style="font-size:16px;font-weight:700;">{{app_name}}</div>
          <div style="font-size:13px;opacity:.9;">Verify your email address</div>
        </div>

        <div class="content">
          <p style="margin:0 0 10px 0;">Hi {{user_name}},</p>

          <p style="margin:0 0 14px 0;">
            Thanks for registering with <b>{{app_name}}</b>. Please confirm your email to activate your account.
          </p>

          <p style="margin:0 0 16px 0;">
            <a class="btn" href="{{verify_url}}" target="_blank" rel="noopener">Verify email</a>
          </p>

          <div class="muted">
            This link will expire in <b>{{expiry_minutes}}</b> minutes.
          </div>

          <div class="hr"></div>

          <p class="muted" style="margin:0 0 8px 0;">
            If the button doesn’t work, copy and paste this URL into your browser:
          </p>
          <div class="code">{{verify_url}}</div>

          <div class="hr"></div>

          <p class="muted" style="margin:0;">
            If you didn’t create an account, you can safely ignore this email.
          </p>

          <p class="muted" style="margin:10px 0 0 0;">
            © {{year}} {{app_name}} · <a href="{{support_url}}" style="color:#2563eb;text-decoration:none;">Support</a>
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
$HTML$,
  $TEXT$
Hi {{user_name}},

Thanks for registering with {{app_name}}. Please confirm your email to activate your account.

Verify email: {{verify_url}}

This link will expire in {{expiry_minutes}} minutes.
If you didn’t create an account, you can safely ignore this email.

© {{year}} {{app_name}} | Support: {{support_url}}
$TEXT$
);

-- Forgot / Reset
INSERT INTO email_templates
(key, locale, version, is_active, is_published, subject_tpl, html_tpl, text_tpl)
VALUES
(
  'auth.reset',
  'en',
  1,
  TRUE,
  TRUE,
  'Reset your password - {{app_name}}',
  $HTML$
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Reset your password</title>
    <style>
      body { margin:0; padding:0; background:#f6f7fb; font-family: Arial, Helvetica, sans-serif; color:#111827; }
      .wrap { width:100%; padding:24px 12px; }
      .card { max-width:560px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 6px 22px rgba(0,0,0,0.06); }
      .header { padding:18px 22px; background:#7c2d12; color:#ffffff; }
      .content { padding:22px; line-height:1.55; }
      .btn { display:inline-block; padding:12px 16px; border-radius:10px; background:#ea580c; color:#ffffff !important; text-decoration:none; font-weight:700; }
      .muted { color:#6b7280; font-size:13px; }
      .hr { height:1px; background:#eef2f7; margin:18px 0; }
      .code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background:#f3f4f6; padding:10px 12px; border-radius:10px; word-break:break-all; }
      .warning { background:#fff7ed; border:1px solid #fed7aa; padding:12px 12px; border-radius:12px; color:#7c2d12; font-size:13px; }
      @media (max-width: 480px) { .header, .content { padding:16px; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="header">
          <div style="font-size:16px;font-weight:700;">{{app_name}}</div>
          <div style="font-size:13px;opacity:.95;">Password reset request</div>
        </div>

        <div class="content">
          <p style="margin:0 0 10px 0;">Hi {{user_name}},</p>

          <p style="margin:0 0 14px 0;">
            We received a request to reset your password. Click the button below to set a new one.
          </p>

          <p style="margin:0 0 16px 0;">
            <a class="btn" href="{{reset_url}}" target="_blank" rel="noopener">Reset password</a>
          </p>

          <div class="warning">
            This link will expire in <b>{{expiry_minutes}}</b> minutes and can be used only once.
          </div>

          <div class="hr"></div>

          <p class="muted" style="margin:0 0 8px 0;">
            If the button doesn’t work, copy and paste this URL into your browser:
          </p>
          <div class="code">{{reset_url}}</div>

          <div class="hr"></div>

          <p class="muted" style="margin:0 0 6px 0;">
            If you didn’t request this, you can ignore this email. Your password won’t change.
          </p>

          <p class="muted" style="margin:0;">
            Request details: IP {{request_ip}} · Device {{request_device}} · Time {{request_time}}
          </p>

          <p class="muted" style="margin:10px 0 0 0;">
            © {{year}} {{app_name}} · <a href="{{support_url}}" style="color:#ea580c;text-decoration:none;">Support</a>
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
$HTML$,
  $TEXT$
Hi {{user_name}},

We received a request to reset your password. Use the link below to set a new one:
{{reset_url}}

This link will expire in {{expiry_minutes}} minutes and can be used only once.

If you didn’t request this, you can ignore this email. Your password won’t change.

Request details: IP {{request_ip}} | Device {{request_device}} | Time {{request_time}}
© {{year}} {{app_name}} | Support: {{support_url}}
$TEXT$
);
```

---

# 2) Node.js (TypeScript) + Apollo Server + SendGrid (Full code)

## 2.1 `package.json` dependencies ที่ต้องใช้

```bash
npm i @apollo/server graphql pg @sendgrid/mail handlebars zod
npm i -D typescript ts-node @types/node @types/pg
```

---

## 2.2 `src/db.ts`

```ts
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ถ้าใช้ SSL บน production:
  // ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});
```

---

## 2.3 `src/templateRepo.ts`

ดึง template “ตัวล่าสุด” (version มากสุด) ที่ active + published ตาม `key + locale`

```ts
import { pool } from "./db";

export type EmailTemplateRow = {
  id: string;
  key: string;
  locale: string;
  version: number;
  subject_tpl: string;
  html_tpl: string;
  text_tpl: string | null;
};

export async function getLatestTemplate(key: string, locale: string): Promise<EmailTemplateRow> {
  const { rows } = await pool.query<EmailTemplateRow>(
    `
    SELECT id, key, locale, version, subject_tpl, html_tpl, text_tpl
    FROM email_templates
    WHERE key = $1
      AND locale = $2
      AND is_active = true
      AND is_published = true
    ORDER BY version DESC
    LIMIT 1
    `,
    [key, locale]
  );

  if (!rows[0]) {
    // fallback: ถ้า locale ไม่เจอ ลอง 'en'
    if (locale !== "en") return getLatestTemplate(key, "en");
    throw new Error(`Template not found: key=${key}, locale=${locale}`);
  }

  return rows[0];
}
```

---

## 2.4 `src/templateRender.ts`

ใช้ Handlebars render `subject/html/text`

```ts
import Handlebars from "handlebars";
import type { EmailTemplateRow } from "./templateRepo";

export type RenderedEmail = {
  subject: string;
  html: string;
  text?: string;
};

export function renderTemplate(tpl: EmailTemplateRow, data: Record<string, any>): RenderedEmail {
  const subject = Handlebars.compile(tpl.subject_tpl, { noEscape: true })(data);
  const html = Handlebars.compile(tpl.html_tpl, { noEscape: true })(data);
  const text = tpl.text_tpl
    ? Handlebars.compile(tpl.text_tpl, { noEscape: true })(data)
    : undefined;

  return { subject, html, text };
}
```

---

## 2.5 `src/mailer.ts`

ส่งด้วย SendGrid แบบ content (ไม่ใช้ SendGrid TemplateId)

```ts
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  await sgMail.send({
    to: args.to,
    from: process.env.SENDGRID_FROM_EMAIL!,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
}
```

---

## 2.6 `src/schema.ts`

ทำ Mutation: `sendAuthEmailVerify`, `sendAuthEmailReset`

```ts
import { gql } from "graphql-tag";

export const typeDefs = gql`
  scalar JSON

  type Mutation {
    sendAuthEmailVerify(to: String!, locale: String, payload: JSON!): Boolean!
    sendAuthEmailReset(to: String!, locale: String, payload: JSON!): Boolean!
  }

  type Query {
    _health: String!
  }
`;
```

---

## 2.7 `src/resolvers.ts`

ดึง template จาก Postgres → render → send

```ts
import { GraphQLScalarType, Kind } from "graphql";
import { getLatestTemplate } from "./templateRepo";
import { renderTemplate } from "./templateRender";
import { sendEmail } from "./mailer";

const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) return ast.value;
    if (ast.kind === Kind.OBJECT) return ast; // minimal; ในงานจริงใช้ graphql-type-json จะง่ายกว่า
    return null;
  },
});

function baseData(locale: string) {
  return {
    app_name: process.env.APP_NAME ?? "Voova",
    year: new Date().getFullYear(),
    support_url: process.env.SUPPORT_URL ?? "https://yourdomain.com/support",
    locale,
  };
}

export const resolvers = {
  JSON: JSONScalar,
  Query: {
    _health: () => "ok",
  },
  Mutation: {
    sendAuthEmailVerify: async (_: any, args: { to: string; locale?: string; payload: any }) => {
      const locale = args.locale ?? "en";
      const tpl = await getLatestTemplate("auth.verify", locale);

      const data = {
        ...baseData(locale),
        ...args.payload,
      };

      // payload ควรมี: user_name, verify_url, expiry_minutes
      const rendered = renderTemplate(tpl, data);

      await sendEmail({
        to: args.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      return true;
    },

    sendAuthEmailReset: async (_: any, args: { to: string; locale?: string; payload: any }) => {
      const locale = args.locale ?? "en";
      const tpl = await getLatestTemplate("auth.reset", locale);

      const data = {
        ...baseData(locale),
        ...args.payload,
      };

      // payload ควรมี: user_name, reset_url, expiry_minutes, request_ip, request_device, request_time
      const rendered = renderTemplate(tpl, data);

      await sendEmail({
        to: args.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      return true;
    },
  },
};
```

> หมายเหตุ: scalar JSON ด้านบนเป็นแบบ “พอใช้” ถ้าจะให้ชัวร์ แนะนำ `graphql-type-json` (แต่ผมทำให้เป็น full code แบบไม่ต้องพึ่ง lib เพิ่ม)

---

## 2.8 `src/server.ts`

Apollo Server v4

```ts
import "dotenv/config";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";

async function main() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: Number(process.env.PORT ?? 4000) },
    context: async () => ({
      // ใส่ auth / db context เพิ่มได้ตามโปรเจกต์คุณ
    }),
  });

  console.log(`🚀 Server ready at ${url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

---

# 3) ตัวอย่างเรียกใช้งาน (GraphQL)

## Verify

```graphql
mutation {
  sendAuthEmailVerify(
    to: "hello_world@voovadigital.com"
    locale: "en"
    payload: {
      user_name: "Dev_THor"
      verify_url: "https://yourdomain.com/verify?token=abc"
      expiry_minutes: 30
    }
  )
}
```

## Reset

```graphql
mutation {
  sendAuthEmailReset(
    to: "hello_world@voovadigital.com"
    locale: "en"
    payload: {
      user_name: "Dev_THor"
      reset_url: "https://yourdomain.com/reset?token=xyz"
      expiry_minutes: 30
      request_ip: "1.2.3.4"
      request_device: "Chrome on macOS"
      request_time: "2025-12-24 21:10 (Asia/Bangkok)"
    }
  )
}
```

---

# 4) แนวคิดเพิ่มเติม (แนะนำ)

* ทำหน้า Admin ให้แก้ template ใน DB ได้ → save เป็น **version ใหม่** (version +1) แล้ว publish ตัวล่าสุด
* ใส่ `is_published=false` สำหรับ draft
* ทำ `email_logs` เก็บผลการส่ง + response ของ SendGrid

---

ถ้าคุณอยากได้ “full code ต่อ” แบบมี

* CRUD Template (create/update/publish/version)
* validation ตัวแปรที่ต้องมีต่อ template (`required_vars`)
* email_logs + retry
  บอกได้เลย เดี๋ยวผมจัดให้เป็นชุดเดียวพร้อม SQL + resolvers ครบ ๆ ครับ







-----------------------


ได้เลยครับ 👍
ผมจะตอบแบบ **เอาไปใช้ได้จริงกับโค้ด `registerUser` ที่คุณแปะมา** โดยอธิบายครบ 3 ส่วน:

1. `verify_url` ต้องหน้าตาแบบไหน
2. backend: สร้าง + ตรวจ token
3. frontend (Next.js): หน้า `/verify-email` ใช้งาน `verify_url`

---

# 1) `verify_url` คืออะไร (concept สั้น ๆ)

`verify_url` = ลิงก์ที่ส่งไปในอีเมล
ผู้ใช้กด → browser เปิดหน้าเว็บ → เว็บเรียก API เพื่อ **ยืนยัน email**

ตัวอย่าง:

```
https://yourdomain.com/verify-email?token=RAW_TOKEN
```

> ❗ **RAW_TOKEN = token ที่ยังไม่ hash**
> ใน DB ต้องเก็บ **hash เท่านั้น** (ปลอดภัย)

---

# 2) Backend: สร้าง verify token ใน `registerUser`

จากโค้ดของคุณ ผมจะ “เติมเฉพาะส่วนที่ขาด” ให้ครบ

## 2.1 helper (ถ้ามีแล้วข้าม)

```ts
// lib/authTokens.ts
import crypto from "crypto";

export function generateRawToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
```

---

## 2.2 ตาราง verify token (ต้องมี)

```sql
CREATE TABLE IF NOT EXISTS email_verify_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 2.3 ปรับ `registerUser` ให้สร้าง `verify_url`

### ✅ **โค้ดเวอร์ชันสมบูรณ์ (ตัดเฉพาะส่วนสำคัญ)**

```ts
import { generateRawToken, sha256 } from "@/lib/authTokens";

registerUser: async (_: any, { input }: any) => {
  const { username, email, phone, password, agree } = input;
  if (!agree) throw new Error("Please accept terms");

  const { rows: exists } = await query(
    "SELECT 1 FROM users WHERE email=$1",
    [email]
  );
  if (exists.length) throw new Error("Email already registered");

  const password_hash = await bcrypt.hash(password, 10);

  const { rows: [u] } = await query(
    `INSERT INTO users(name,email,phone,role,password_hash,is_email_verified)
     VALUES($1,$2,$3,'Subscriber',$4,false)
     RETURNING id,email,role,name`,
    [username, email, phone, password_hash]
  );

  /* =========================
     CREATE VERIFY TOKEN
  ========================= */
  const rawToken = generateRawToken();        // ส่งให้ user
  const tokenHash = sha256(rawToken);         // เก็บใน DB
  const expiryMinutes = 30;

  await query(
    `INSERT INTO email_verify_tokens(user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '${expiryMinutes} minutes')`,
    [u.id, tokenHash]
  );

  const verify_url =
    `${process.env.WEB_BASE_URL}/verify-email?token=${rawToken}`;

  /* =========================
     SEND EMAIL (template)
  ========================= */
  const locale = "en";
  const tpl = await getLatestEmailTemplate("auth.verify", locale);

  const rendered = renderEmailTemplate(tpl, {
    ...baseData(locale),
    user_name: u.name,
    verify_url,
    expiry_minutes: expiryMinutes,
  });

  await sendEmail({
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  /* =========================
     LOGIN TOKEN (optional)
  ========================= */
  const token = jwt.sign(
    { id: u.id, email: u.email, role: u.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  cookies().set(USER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie && !isDev,
    path: "/",
  });

  return true;
},
```

---

# 3) Backend: mutation สำหรับ verify email

เพิ่ม mutation ใหม่ เช่น `verifyEmail(token)`

```ts
verifyEmail: async (_: any, { token }: { token: string }) => {
  const tokenHash = sha256(token);

  const { rows } = await query(
    `
    SELECT evt.id, evt.user_id
    FROM email_verify_tokens evt
    WHERE evt.token_hash = $1
      AND evt.used_at IS NULL
      AND evt.expires_at > now()
    LIMIT 1
    `,
    [tokenHash]
  );

  if (!rows[0]) {
    return { ok: false, message: "Invalid or expired token" };
  }

  const { id: tokenId, user_id } = rows[0];

  await query(`UPDATE users SET is_email_verified = true WHERE id = $1`, [
    user_id,
  ]);

  await query(
    `UPDATE email_verify_tokens SET used_at = now() WHERE id = $1`,
    [tokenId]
  );

  return { ok: true, message: "Email verified successfully" };
},
```

---

# 4) Frontend (Next.js): หน้า `/verify-email`

## 4.1 URL ที่ user กดจาก email

```
https://yourdomain.com/verify-email?token=abc123
```

---

## 4.2 ตัวอย่างหน้า Next.js (`app/verify-email/page.tsx`)

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { gql, useMutation } from "@apollo/client";

const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token) {
      ok
      message
    }
  }
`;

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [verifyEmail] = useMutation(VERIFY_EMAIL);
  const [status, setStatus] = useState("Verifying...");

  useEffect(() => {
    if (!token) {
      setStatus("Invalid link");
      return;
    }

    verifyEmail({ variables: { token } })
      .then(({ data }) => {
        if (data.verifyEmail.ok) {
          setStatus("✅ Email verified successfully");
        } else {
          setStatus(data.verifyEmail.message);
        }
      })
      .catch(() => {
        setStatus("Verification failed");
      });
  }, [token]);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>{status}</h1>
    </div>
  );
}
```

---

# 5) Flow สรุป (สำคัญ)

```
registerUser
   ↓
create verify token (raw + hash)
   ↓
send email with verify_url
   ↓
user click link
   ↓
/verify-email?token=RAW
   ↓
verifyEmail mutation
   ↓
mark users.is_email_verified = true
```

---

# 6) Best Practice แนะนำ

* ❌ อย่าใช้ JWT เป็น verify token
* ✅ ใช้ random token + hash
* ✅ token ใช้ได้ครั้งเดียว (`used_at`)
* ✅ มี expiry
* 🔒 อย่า auto-login ถ้า email ยังไม่ verified (optional)

---

ถ้าคุณต้องการ:

* 🔁 resend verify email
* 🚫 block login ถ้ายังไม่ verify
* 📊 log verify attempts

ส่งมาได้เลย ผมจะต่อให้ตรงกับ codebase คุณแบบไม่ต้องเดาเองครับ 💯
