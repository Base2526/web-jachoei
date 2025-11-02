import crypto from "crypto";
import { GraphQLError } from "graphql/error";
import bcrypt from 'bcryptjs';

import { query, runInTransaction } from "@/lib/db";
import { pubsub } from "@/lib/pubsub";

import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { USER_COOKIE, ADMIN_COOKIE, JWT_SECRET } from "@/lib/auth/token";

const TOKEN_TTL_DAYS = 7;
const topicChat = (chat_id: string) => `MSG_CHAT_${chat_id}`;
const topicUser = (user_id: string) => `MSG_USER_${user_id}`;

type Iso = string;

import { createHash } from "crypto";
import { createResetToken, sendPasswordResetEmail } from "@/lib/passwordReset";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function requireAuth(ctx: any): string {
  const uid = ctx?.user?.id;
  if (!uid) {
    throw new GraphQLError("Unauthenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return uid;
}

function requireUser(ctx: any) {
  const user = ctx?.user;
  if (!user) throw new Error("Unauthorized");
  return user;
}

function requireAdmin(ctx: any) {
  const admin = ctx?.admin;
  if (!admin) throw new Error("Forbidden (admin only)");
  return admin;
}

export const resolvers = {
  Query: {
    _health: () => "ok",
    meRole: async (_:any, __:any, ctx:any) => ctx.role || "Subscriber",
    posts: async (_:any, { search }:{search?:string}, ctx: any) => {
      console.log("[Query] posts :", ctx);

      if (search) {
        const { rows } = await query(
          `SELECT p.*, row_to_json(u.*) as author_json
           FROM posts p LEFT JOIN users u ON p.author_id = u.id
           WHERE p.title ILIKE $1 OR p.phone ILIKE $1
           ORDER BY p.created_at DESC`, ['%' + search + '%']
        );
        return rows.map((r: { author_json: any; })=>({ ...r, author: r.author_json }));
      }
      const { rows } = await query(
        `SELECT p.*, row_to_json(u.*) as author_json
         FROM posts p LEFT JOIN users u ON p.author_id = u.id
         ORDER BY p.created_at DESC`
      );
      return rows.map((r: { author_json: any; })=>({ ...r, author: r.author_json }));
    },
    post: async (_:any, { id }:{id:string}, ctx: any) => {
      console.log("[Query] post :", ctx);

      const { rows } = await query(
        `SELECT p.*, row_to_json(u.*) as author_json
         FROM posts p LEFT JOIN users u ON p.author_id = u.id
         WHERE p.id = $1`, [id]
      );
      const r = rows[0]; if (!r) return null;
      return { ...r, author: r.author_json };
    },
    myPosts: async (_:any, { search }:{search?:string}, ctx:any) => {

      console.log("[myPosts] :", ctx);

      const author_id = requireAuth(ctx);

      if (search) {
        const { rows } = await query(
          `SELECT p.*, row_to_json(u.*) as author_json
           FROM posts p LEFT JOIN users u ON p.author_id = u.id
           WHERE p.author_id=$1 AND (p.title ILIKE $2 OR p.phone ILIKE $2)
           ORDER BY p.created_at DESC`, [author_id, '%' + search + '%']
        );
        return rows.map((r :any)=>({ ...r, author: r.author_json }));
      }
      const { rows } = await query(
        `SELECT p.*, row_to_json(u.*) as author_json
         FROM posts p LEFT JOIN users u ON p.author_id = u.id
         WHERE p.author_id=$1
         ORDER BY p.created_at DESC`, [author_id]
      );
      return rows.map((r :any)=>({ ...r, author: r.author_json }));
    },
    getOrCreateDm: async (_:any, { user_id }:{user_id:string}, ctx: any) => {

      const author_id = requireAuth(ctx);

      if (!author_id) throw new Error("No demo user found");
      const { rows:exist } = await query(
        `SELECT c.* FROM chats c
         JOIN chat_members m1 ON m1.chat_id=c.id AND m1.user_id=$1
         JOIN chat_members m2 ON m2.chat_id=c.id AND m2.user_id=$2
         WHERE c.is_group=false LIMIT 1`, [author_id, user_id]
      );
      if (exist[0]) return exist[0];
      const { rows:crows } = await query(
        `INSERT INTO chats(is_group, created_by) VALUES(false, $1) RETURNING *`, [author_id]
      );
      const chat = crows[0];

      console.log("[getOrCreateDm]" , chat.id, author_id, user_id);
      // await query(`INSERT INTO chat_members(chat_id, user_id) VALUES ($1,$2),($1,$3)`, [chat.id, meId, user_id]);
      return chat;
    },
    myChats: async (_:any, { }:{}, ctx: any) => {
      console.log("[myChats] :", ctx);

      const author_id = requireAuth(ctx);

      const { rows } = await query(
        `SELECT c.*, row_to_json(uc.*) as creator_json
         FROM chats c 
         LEFT JOIN users uc ON c.created_by = uc.id
         WHERE EXISTS (SELECT 1 FROM chat_members m WHERE m.chat_id = c.id AND m.user_id = $1)
         ORDER BY c.created_at DESC`, [author_id]
      );
      const out:any[] = [];
      for (const c of rows){
        const mem = await query(
          `SELECT u.* FROM chat_members m JOIN users u ON m.user_id=u.id WHERE m.chat_id=$1`, [c.id]
        );
        out.push({ 
          ...c, 
          created_by: c.creator_json, 
          members: mem.rows 
        });
      }
      return out;
    },
    messages: async (
                      _: any,
                      { chat_id, limit = 50, offset = 0, includeDeleted = false }: { chat_id: string; limit?: number; offset?: number; includeDeleted?: boolean },
                      ctx: any
                    ) => {
      const meId = requireAuth(ctx); // ⬅️ เอา user ปัจจุบัน

      const filter = includeDeleted ? "" : "AND m.deleted_at IS NULL";
      const { rows } = await query(
        `
        SELECT
          m.*,
          (m.deleted_at IS NOT NULL) AS is_deleted,
          row_to_json(u.*) AS sender_json,

          -- myReceipt ของคนที่ล็อกอิน
          (
            SELECT json_build_object(
              'delivered_at', r.delivered_at,
              'read_at',      r.read_at,
              'is_read',      (r.read_at IS NOT NULL)
            )
            FROM message_receipts r
            WHERE r.message_id = m.id AND r.user_id = $2
            LIMIT 1
          ) AS my_receipt_json,

          -- ผู้อ่านทั้งหมด (ที่มี read_at)
          (
            SELECT COALESCE(json_agg(row_to_json(ru.*) ORDER BY r2.read_at ASC), '[]'::json)
            FROM message_receipts r2
            JOIN users ru ON ru.id = r2.user_id
            WHERE r2.message_id = m.id AND r2.read_at IS NOT NULL
          ) AS readers_json,

          -- จำนวนผู้อ่าน
          (
            SELECT COUNT(*)::INT
            FROM message_receipts r3
            WHERE r3.message_id = m.id AND r3.read_at IS NOT NULL
          ) AS readers_count

        FROM messages m
        LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.chat_id = $1 ${filter}
        ORDER BY m.created_at ASC
        LIMIT $3 OFFSET $4
        `,
        [chat_id, meId, limit, offset]
      );

      

      const results =  rows.map((r: any) => {
        const createdISO = new Date(r.created_at).toISOString();
        const mr = r.my_receipt_json || null;

        console.log("[r.is_deleted]", r.is_deleted, r.deleted_at);
        return {
          ...r,
          sender: r.sender_json,
          created_at: createdISO,

          myReceipt: {
            deliveredAt: mr?.delivered_at ? new Date(mr.delivered_at).toISOString() : createdISO,
            readAt:      mr?.read_at      ? new Date(mr.read_at).toISOString()      : null,
            isRead:      !!mr?.is_read,
          },

          readers: Array.isArray(r.readers_json) ? r.readers_json : [],
          readersCount: Number(r.readers_count) || 0,

          is_deleted: r.is_deleted ?? false,
          deleted_at: r.deleted_at ? new Date(r.deleted_at).toISOString() : '',
          text: r.is_deleted ? "" : r.text,
        };
      });

      console.log("[messages - results] :", results);

      return results;
    },
    users: async (_: any, { search }: { search?: string }, ctx: any) => {
      // const author_id = requireAuth(ctx);

      if (search) {
        const { rows } = await query(
          `SELECT * FROM users
           WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
           ORDER BY created_at DESC`, ['%' + search + '%']
        );
        return rows;
      }
      const { rows } = await query(`SELECT * FROM users ORDER BY created_at DESC`);
      return rows;
    },
    user: async (_: any, { id }: { id: string }) => {
      const { rows } = await query(`SELECT * FROM users WHERE id=$1`, [id]);
      return rows[0] || null;
    },
    postsByUserId: async (_:any, { user_id }:{user_id:string}) => {
      const { rows } = await query(
        `SELECT p.*, row_to_json(u.*) as author_json
         FROM posts p LEFT JOIN users u ON p.author_id = u.id
         WHERE p.author_id = $1
         ORDER BY p.created_at DESC`, [user_id]
      );
      return rows.map((r: any)=>({ ...r, author: r.author_json }));
    },
    me: async (_: any, {  }: { }, ctx: any) => {
      // return await currentUser();
      const author_id = requireAuth(ctx);

      const { rows } = await query(`SELECT * FROM users WHERE id=$1 LIMIT 1`, [author_id]);
      return rows[0];
    },
    unreadCount: async (_:any, { chatId }:{ chatId: string }, ctx:any) => {
      const meId = requireAuth(ctx);
      const { rows } = await query(
        `SELECT unread_count FROM chat_unread_counts WHERE user_id=$1 AND chat_id=$2`,
        [meId, chatId]
      ).catch(()=>({ rows:[] as any[] }));
      if (rows[0]) return Number(rows[0].unread_count || 0);

      const { rows:rows2 } = await query(
        `SELECT COUNT(*)::BIGINT AS unread_count
         FROM messages m
         LEFT JOIN message_receipts r ON r.message_id=m.id AND r.user_id=$1
         WHERE m.chat_id=$2 
          AND m.sender_id <> $1 
          AND (r.read_at IS NULL)
          AND m.deleted_at IS NULL`,
        [meId, chatId]
      );
      return Number(rows2[0]?.unread_count || 0);
    },
    whoRead: async (_:any, { messageId }:{messageId:string}, ctx:any) => {
      requireAuth(ctx);
      const { rows } = await query(
        `SELECT u.* FROM message_receipts r
         JOIN users u ON u.id = r.user_id
         WHERE r.message_id=$1 AND r.read_at IS NOT NULL
         ORDER BY r.read_at ASC`,
        [messageId]
      );
      return rows;
    },

    stats: async (_:any, __:any, ctx:any) => {
      const results = await Promise.all([
        query(`SELECT COUNT(*)::int AS c FROM users`),
        query(`SELECT COUNT(*)::int AS c FROM posts`),
        query(`SELECT COUNT(*)::int AS c FROM files WHERE deleted_at IS NULL`),
        query(`SELECT COUNT(*)::int AS c FROM system_logs`),
      ]);

      const [users, posts, files, logs] = results.map(( r:any)=> r.rows[0].c);

      return { users, posts, files, logs };
    },
    latestUsers: async (_:any,{limit=5}:any, ctx:any)=>{
      const {rows}=await query(`SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT $1`,[limit]);
      return rows;
    },
    latestPosts: async (_:any,{limit=5}:any, ctx:any)=>{
      const {rows}=await query(`SELECT id,title,status,created_at FROM posts ORDER BY created_at DESC LIMIT $1`,[limit]);
      return rows;
    },
    pending: async () => {
      const [posts, users, files, logs] = await Promise.all([
        query(`SELECT COUNT(*)::int AS c FROM posts WHERE status = 'pending'`),
        query(`SELECT COUNT(*)::int AS c FROM users WHERE status = 'invited' OR email_verified = false`),
        query(`SELECT COUNT(*)::int AS c FROM files WHERE category IS NULL AND deleted_at IS NULL`),
        query(`SELECT COUNT(*)::int AS c FROM system_logs WHERE level = 'error' AND created_at >= NOW() - INTERVAL '24 hours'`)
      ]);

      return {
        posts_awaiting_approval: posts.rows[0]?.c || 0,
        users_pending_invite: users.rows[0]?.c || 0,
        files_unclassified: files.rows[0]?.c || 0,
        errors_last24h: logs.rows[0]?.c || 0,
      };
    },

  },
  Mutation: {
    login: async (_: any, { input }: { input: { email?: string; username?: string; password: string } }, ctx: any) => {
      
      console.log("[login]");
      const { email, username, password } = input || {};
      if (!password || (!email && !username)) {
        throw new Error("Email/Username and password are required");
      }

      // เลือกฟิลด์ที่ใช้ล็อกอิน: email (แนะนำ) หรือ username (ถ้ามีคอลัมน์นี้ใน users)
      // ตัวอย่างนี้ใช้ email เป็นหลัก
      const identifier = email?.trim().toLowerCase() || username?.trim();
      const idField = email ? "email" : "name"; // ถ้าอยากใช้ username จริง ๆ ให้มีคอลัมน์ username แยก

      // ตรวจสอบรหัสผ่านด้วย pgcrypto (bcrypt)
      const { rows } = await query(
        `
        SELECT id, name, email, role, avatar, phone
        FROM users
        WHERE ${idField} = $1
          AND password_hash = crypt($2, password_hash)
        LIMIT 1
        `,
        [identifier, password]
      );

      const user = rows[0];
      if (!user) {
        // ป้องกันการเดารหัส/บัญชี โดยไม่บอกว่า email หรือ password ผิด
        return { ok: false, message: "Invalid credentials" };
      }

      // // สร้าง token อย่างง่าย (ควรเปลี่ยนเป็น JWT/Session จริงในงานจริง)
      // const token = crypto.randomBytes(24).toString("base64url");

      // // ถ้าต้องการเก็บ session/token ใน DB ให้สร้างตาราง sessions แล้ว INSERT ที่นี่
      // // await query(`INSERT INTO sessions(user_id, token, expired_at) VALUES ($1,$2,NOW() + interval '7 days')`, [user.id, token]);

      // // ถ้าใช้ Next.js API route สามารถตั้ง cookie httpOnly ที่ layer ของ API ได้
      // // ctx.res?.setHeader("Set-Cookie", `token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);


      // สร้าง token ใหม่
      const token = crypto.randomBytes(32).toString("base64url");
      const ttlDays = TOKEN_TTL_DAYS;
      const ua = ctx?.req?.headers?.get?.("user-agent") || null;
      const ip =
        (ctx?.req?.headers?.get?.("x-forwarded-for") || "").split(",")[0].trim() ||
        ctx?.req?.ip ||
        null;

      // (ทางเลือก) ยกเลิก session เดิมของผู้ใช้ (ให้มี 1 session ต่อคน)
      // await query(`DELETE FROM sessions WHERE user_id=$1`, [user.id]);

      // แทรก session ใหม่
      await query(
        `
        INSERT INTO sessions (token, user_id, user_agent, ip, expired_at)
        VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval)
        `,
        [token, user.id, ua, ip, String(ttlDays)]
      );

      // (ทางเลือกแนะนำ) ตั้ง httpOnly cookie ที่ชั้น Route/Handler
      // ctx.res?.setHeader("Set-Cookie", `token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlDays*86400}`);


      return {
        ok: true,
        message: "Login success",
        token,
        user,
      };
    },

    // loginUser: async (_: any, { email, password }: any) => {
    loginUser: async (_: any, { input }: { input: { email?: string; username?: string; password: string } }, ctx: any) => {
      console.log("[loginUser] @1 ", input)
      const { email, username, password } = input || {};
      if (!password || (!email && !username)) {
        throw new Error("Email/Username and password are required");
      }

      const { rows } = await query("SELECT * FROM users WHERE email=$1", [email]);
      const user = rows[0];

      console.log("[loginUser] @2 ", user)
      if (!user) throw new Error("Invalid credentials");
      // if (user.password_hash !== hash(password)) throw new Error("Invalid credentials");

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      cookies().set(USER_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
      return {
        ok: true,
        message: "Login success",
        token,
        user,
      };
    },

    // loginAdmin: async (_: any, { email, password }: any) => {
    //   const { rows } = await query("SELECT * FROM users WHERE email=$1", [email]);
    //   const admin = rows[0];
    //   if (!admin || admin.role !== "Administrator") throw new Error("Not admin");
    //   // if (admin.password_hash !== hash(password)) throw new Error("Invalid credentials");

    //   const token = jwt.sign(
    //     { id: admin.id, email: admin.email, role: admin.role },
    //     JWT_SECRET,
    //     { expiresIn: "1d" }
    //   );

    //   cookies().set(ADMIN_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/admin" });
    //   return true;
    // },

    loginAdmin: async (_: any, { input }: { input: { email?: string; username?: string; password: string } }, ctx: any) => {
      console.log("[loginAdmin] @1 ", input)
      const { email, username, password } = input || {};
      if (!password || (!email && !username)) {
        throw new Error("Email/Username and password are required");
      }

      const { rows } = await query("SELECT * FROM users WHERE email=$1", [email]);
      const user = rows[0];

      console.log("[loginAdmin] @2 ", user)
      if (!user) throw new Error("Invalid credentials");
      // if (user.password_hash !== hash(password)) throw new Error("Invalid credentials");

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      cookies().set(ADMIN_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
      return {
        ok: true,
        message: "Login success",
        token,
        user,
      };
    },

    async registerUser(_: any, { input }: any) {
      const { name, email, phone, password, agree } = input;
      if (!agree) throw new Error('Please accept terms');
      const { rows: exists } = await query('SELECT 1 FROM users WHERE email=$1', [email]);
      if (exists.length) throw new Error('Email already registered');

      const password_hash = await bcrypt.hash(password, 10);
      const { rows: [u] } = await query(
        `INSERT INTO users(name,email,phone,role,password_hash)
        VALUES($1,$2,$3,'Subscriber',$4) RETURNING id,email,role`,
        [name, email, phone, password_hash]
      );

      const token = jwt.sign({ id: u.id, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
      cookies().set(USER_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: true, path: '/' });

      return true;
    },

    async requestPasswordReset(_: any, { email }: { email: string }, ctx: any) {
      // 1) หา user จากอีเมล (อย่า leak ว่ามี/ไม่มี)
      const { rows } = await query(`SELECT id, email FROM users WHERE email = $1`, [email]);
      if (rows.length === 0) {
        // กลับ true เสมอเพื่อไม่ให้เดาอีเมลง่าย
        return true;
      }
      const user = rows[0];

      // (ออปชัน) ทำ rate-limit by IP/email เพื่อลด spam

      // 2) สร้าง token + insert
      const { token } = await createResetToken(user.id);

      // 3) สร้างลิงก์ไปหน้า /reset
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://yourapp.com";
      const resetUrl = `${baseUrl}/reset?token=${encodeURIComponent(token)}`;

      // 4) ส่งเมล
      await sendPasswordResetEmail(user.email, resetUrl);
      return true;
    },

    async resetPassword(_: any, { token, newPassword }: { token: string; newPassword: string }, ctx: any) {
      // 1) หา token
      const { rows } = await query(
        `SELECT prt.id, prt.user_id, prt.expires_at, prt.used
           FROM password_reset_tokens prt
           WHERE prt.token = $1`,
        [token]
      );
      if (rows.length === 0) throw new Error("Invalid token");

      const t = rows[0];
      if (t.used) throw new Error("Token already used");
      if (new Date(t.expires_at).getTime() < Date.now()) throw new Error("Token expired");

      // 2) อัปเดตรหัสผ่าน (แนะนำใช้ bcrypt/argon2; ที่นี่ตัวอย่าง sha256 เพื่อความง่าย)
      const password_hash = sha256Hex(newPassword);
      await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [password_hash, t.user_id]);

      // 3) มาร์ค token เป็นใช้แล้ว
      await query(`UPDATE password_reset_tokens SET used = true WHERE id = $1`, [t.id]);

      // (ออปชัน) revoke sessions อื่นๆ ของ user นี้

      return true;
    },
    upsertPost: async (_:any, { id, data }:{id?:string, data:any}, ctx:any) => {
      console.log("[Mutation] upsertPost :", data);
      if (!ctx?.user?.id) {
        // throw new Error("Unauthorized");
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      const author_id = ctx.user.id;

      if (id) {
        const { rows } = await query(
          `UPDATE posts SET title=$1, body=$2, image_url=$3, phone=$4, status=$5, updated_at=NOW()
           WHERE id=$6 RETURNING *`,
          [data.title, data.body, data.image_url, data.phone, data.status, id]
        );
        return rows[0];
      } else {
        const { rows } = await query(
          `INSERT INTO posts (title, body, image_url, phone, status, author_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [data.title, data.body, data.image_url, data.phone, data.status, author_id]
        );
        return rows[0];
      }
    },
    deletePost: async (_:any, { id }:{id:string}, ctx:any) => {
      if (!ctx?.user?.id) {
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      const author_id = ctx.user.id;

      const res = await query(`DELETE FROM posts WHERE id=$1`, [id]);
      return res.rowCount === 1;
    },
    createChat: async (_:any, { name, isGroup, memberIds }:{name?:string, isGroup:boolean, memberIds:string[]}, ctx:any) => {
      // const me = await currentUserId();
      if (!ctx?.user?.id) {
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      const author_id = ctx.user.id;

      const { rows } = await query(
        `INSERT INTO chats (name, is_group, created_by) VALUES ($1,$2,$3) RETURNING *`,
        [name || null, isGroup, author_id]
      );
      const chat = rows[0];
      const allMembers = Array.from(new Set([author_id, ...memberIds]));
      for (const uid of allMembers){
        await query(`INSERT INTO chat_members (chat_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [chat.id, uid]);
      }
      const mem = await query(
        `SELECT u.* FROM chat_members m JOIN users u ON m.user_id=u.id WHERE m.chat_id=$1`, [chat.id]
      );
      const creator = await query(`SELECT * FROM users WHERE id=$1`, [chat.created_by]);
      return { ...chat, created_by: creator.rows[0], members: mem.rows };
    },

    addMember: async (_:any, { chat_id, user_id }:{chat_id:string, user_id:string}) => {
      await query(`INSERT INTO chat_members (chat_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [chat_id, user_id]);
      return true;
    },

    // sendMessage: async (_:any, { chat_id, text, to_user_ids}:{chat_id:string, text:string, to_user_ids: string[]}, ctx:any) => {
    //   // const me = await currentUserId();

    //   console.log("[sendMessage] @1 ", chat_id, text);
    //   if (!ctx?.user?.id) {
    //     throw new GraphQLError('Unauthenticated', {
    //       extensions: { code: 'UNAUTHENTICATED' }
    //     });
    //   }
    //   const author_id = ctx.user.id;
    //   const { rows } = await query(
    //     `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1,$2,$3) RETURNING *`,
    //     [chat_id, author_id, text]
    //   );
    //   const msg = rows[0];
    //   const senderQ = await query(`SELECT * FROM users WHERE id=$1`, [msg.sender_id]);
    //   const message = { id: msg.id, chat_id: msg.chat_id, sender: senderQ.rows[0], text: msg.text, created_at: new Date(msg.created_at).toISOString(), to_user_ids };

    //   await pubsub.publish(topicChat(chat_id), { messageAdded: message });
    //   await Promise.all(
    //     to_user_ids.map(uid => pubsub.publish(topicUser(uid), { userMessageAdded: message }))
    //   );
    //   console.log("[sendMessage] @2 ", message);
      
    //   return message;
    // },
     sendMessage: async (
      _: any,
      { chat_id, text, to_user_ids }: { chat_id: string; text: string; to_user_ids: string[] },
      ctx: any
    ) => {
      const  sender_id = requireAuth(ctx);
      
      const cleanTo = Array.from(
        new Set((to_user_ids || []).filter(Boolean).filter((id) => id !== sender_id))
      );

      // ✅ ใช้ runInTransaction แทน
      const fullMessage = await runInTransaction(async (client) => {
        // 1) insert message
        const msgRes = await client.query(
          `INSERT INTO messages (chat_id, sender_id, text)
           VALUES ($1,$2,$3)
           RETURNING *`,
          [chat_id, sender_id, text]
        );
        const msg = msgRes.rows[0];

        // 2) insert receipts (recipients)
        if (cleanTo.length > 0) {
          await client.query(
            `
            INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
            SELECT $1 AS message_id, uid, NOW() AS delivered_at, NULL::timestamptz AS read_at
            FROM UNNEST($2::uuid[]) AS u(uid)
            ON CONFLICT (message_id, user_id) DO NOTHING
            `,
            [msg.id, cleanTo]
          );
        }

        // 3) insert sender receipt
        await client.query(
          `
          INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
          VALUES ($1,$2,NOW(),NOW())
          ON CONFLICT (message_id, user_id) DO NOTHING
          `,
          [msg.id, sender_id]
        );

        // 4) ดึงข้อมูลประกอบ
        const senderQ = await client.query(`SELECT * FROM users WHERE id=$1`, [sender_id]);
        const readersQ = await client.query(
          `
          SELECT u.*
          FROM message_receipts r
          JOIN users u ON u.id = r.user_id
          WHERE r.message_id=$1 AND r.read_at IS NOT NULL
          ORDER BY r.read_at ASC
          `,
          [msg.id]
        );

        const cntQ = await client.query(
          `SELECT COUNT(*)::INT AS c
           FROM message_receipts
           WHERE message_id=$1 AND read_at IS NOT NULL`,
          [msg.id]
        );
        const readersCount: number = Number(cntQ.rows[0]?.c || 0);

        const myRecQ = await client.query(
          `
          SELECT delivered_at, read_at, (read_at IS NOT NULL) AS is_read
          FROM message_receipts
          WHERE message_id=$1 AND user_id=$2
          LIMIT 1
          `,
          [msg.id, sender_id]
        );
        const mr = myRecQ.rows[0] || {};
        const myReceipt = {
          deliveredAt: mr?.delivered_at
            ? new Date(mr.delivered_at).toISOString()
            : new Date(msg.created_at).toISOString(),
          readAt: mr?.read_at ? new Date(mr.read_at).toISOString() : null,
          isRead: !!mr?.is_read,
        };

        const fullMsg = {
          id: msg.id,
          chat_id: msg.chat_id,
          sender: senderQ.rows[0],
          text: msg.text,
          created_at:
            msg.created_at instanceof Date
              ? msg.created_at.toISOString()
              : new Date(msg.created_at).toISOString(),
          to_user_ids: cleanTo,
          myReceipt,
          readers: readersQ.rows,
          readersCount,

          is_deleted: false,
          deletedAt: null,
        };

        return fullMsg;
      });

      // 5) publish หลัง transaction commit
      await pubsub.publish(topicChat(fullMessage.chat_id), { messageAdded: fullMessage });

      await Promise.all(
        fullMessage.to_user_ids.map(async (uid) => {
          const r = await query(
            `
            SELECT delivered_at, read_at, (read_at IS NOT NULL) AS is_read
            FROM message_receipts
            WHERE message_id=$1 AND user_id=$2
            LIMIT 1
            `,
            [fullMessage.id, uid]
          );
          const pr = r.rows[0] || {};
          const perUserMessage = {
            ...fullMessage,
            myReceipt: {
              deliveredAt: pr?.delivered_at
                ? new Date(pr.delivered_at).toISOString()
                : fullMessage.created_at,
              readAt: pr?.read_at ? new Date(pr.read_at).toISOString() : null,
              isRead: !!pr?.is_read,
            },
          };
          await pubsub.publish(topicUser(uid), { userMessageAdded: perUserMessage });
        })
      );

      return fullMessage;
    },
    upsertUser: async (_: any, { id, data }: { id?: string, data: any }, ctx:any) => {

      if (!ctx?.user?.id) {
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      // (ทางเลือก) ทำความสะอาดค่าเล็กน้อย
      const name = (data.name ?? '').trim();
      const avatar = data.avatar ?? null;
      const phone = data.phone ?? null;
      const email = data.email ? String(data.email).trim().toLowerCase() : null;
      const role = (data.role ?? 'Subscriber').trim();
      const passwordHash = data.passwordHash ?? null;

      if (id) {
        // อัปเดต: อัปเดต password_hash เฉพาะเมื่อส่งมาเท่านั้น
        const { rows } = await query(
          `
          UPDATE users
          SET
            name = $1,
            avatar = $2,
            phone = $3,
            role = $4,
            password_hash = CASE
              WHEN $5 IS NULL THEN password_hash
              ELSE $5
            END
          WHERE id = $6
          RETURNING *;
          `,
          [name, avatar, phone, role, passwordHash, id]
        );
        return rows[0] || null;
      } else {
        // สร้างใหม่: ใส่ลำดับพารามิเตอร์ให้ตรงกับคอลัมน์!
        // (name, avatar, phone, email, role, password_hash)
        if (!email) throw new Error("email is required");
        const { rows } = await query(
          `
          INSERT INTO users (name, avatar, phone, email, role, password_hash)
          VALUES ($1,   $2,    $3,   $4,   $5,   $6)
          RETURNING *;
          `,
          [name, avatar, phone, email, role, passwordHash] // ✅ role มาก่อน hash
        );
        return rows[0] || null;
      }
    },
    deleteUser: async (_: any, { id }: { id: string }) => {
      const res = await query(`DELETE FROM users WHERE id=$1`, [id]);
      return res.rowCount === 1;
    },
    updateMyProfile: async (_:any, { data }:{ data: { name?: string, avatar?: string, phone?: string }}, ctx:any) => {
      if (!ctx?.user?.id) {
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      const author_id = ctx.user.id;

      const { rows } = await query(
        `UPDATE users SET 
            name = COALESCE($1, name),
            avatar = COALESCE($2, avatar),
            phone = COALESCE($3, phone)
         WHERE id=$4 RETURNING *`,
        [data.name ?? '', data.avatar ?? '', data.phone ?? '', author_id]
      );
      return rows[0];
    },
    renameChat: async (_:any, { chat_id, name }:{chat_id:string, name?:string}, ctx:any) => {
      if (!ctx?.user?.id) {
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      const author_id = ctx.user.id;

      await query(`UPDATE chats SET name=$1 WHERE id=$2`, [name || null, chat_id]);
      return true;
    },
    deleteChat: async (_:any, { chat_id }:{chat_id:string}, ctx:any) => {
      if (!ctx?.user?.id) {
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      const author_id = ctx.user.id;

      await query(`DELETE FROM chats WHERE id=$1`, [chat_id]);
      return true;
    },
    markMessageRead: async (_:any, { message_id }:{ message_id:string }, ctx:any) => {
      console.log("[markMessageRead]");
      const meId = requireAuth(ctx);
      await query(
        `UPDATE message_receipts
         SET read_at = COALESCE(read_at, NOW())
         WHERE message_id=$1 AND user_id=$2`,
        [message_id, meId]
      );
      return true;
    },
    markChatReadUpTo: async (_:any, { chat_id, cursor }:{ chat_id:string, cursor:string }, ctx:any) => {
      console.log("[markChatReadUpTo]");
      const meId = requireAuth(ctx);

      console.log("[markChatReadUpTo]", meId, chat_id, cursor);
      await query(
        `UPDATE message_receipts r
         SET read_at = COALESCE(r.read_at, NOW())
         FROM messages m
         WHERE r.message_id = m.id
           AND r.user_id = $1
           AND m.chat_id = $2
           AND m.created_at <= ( $3::timestamptz + interval '1 millisecond' )`,
        [meId, chat_id, cursor]
      );
      return true;
    },

    deleteMessage: async (_:any, { message_id }:{ message_id:string }, ctx:any) => {
      const  meId = requireAuth(ctx);
      const { rows } = await query(`SELECT id, chat_id, sender_id, deleted_at FROM messages WHERE id=$1 LIMIT 1`, [message_id]);
      const msg = rows[0];
      if (!msg) return false;
      // const canDelete = (msg.sender_id === meId) || (role === 'Administrator');
      // if (!canDelete) throw new GraphQLError('FORBIDDEN', { extensions: { code: 'FORBIDDEN' } });
      await query(`UPDATE messages SET deleted_at = NOW() WHERE id=$1 AND deleted_at IS NULL`, [message_id]);
      await pubsub.publish(topicChat(msg.chat_id), { messageDeleted: message_id });
      return true;
    },
  },

  // // Message
  // Message: {
  //   myReceipt: async (parent:any, _args:any, ctx:any) => {
  //     const meId = requireAuth(ctx);
  //     const { rows } = await query(
  //       `SELECT delivered_at, read_at, (read_at IS NOT NULL) AS is_read
  //        FROM message_receipts
  //        WHERE message_id=$1 AND user_id=$2`,
  //       [parent.id, meId]
  //     );
  //     const r = rows[0] || null;
  //     return {
  //       deliveredAt: r?.delivered_at ? new Date(r.delivered_at).toISOString() : new Date(parent.created_at).toISOString(),
  //       readAt: r?.read_at ? new Date(r.read_at).toISOString() : null,
  //       isRead: !!r?.is_read
  //     };
  //   },
  //   readers: async (parent:any) => {
  //     const { rows } = await query(
  //       `SELECT u.* FROM message_receipts r
  //        JOIN users u ON u.id = r.user_id
  //        WHERE r.message_id=$1 AND r.read_at IS NOT NULL
  //        ORDER BY r.read_at ASC`,
  //       [parent.id]
  //     );
  //     return rows;
  //   },
  //   readersCount: async (parent:any) => {
  //     const { rows } = await query(
  //       `SELECT COUNT(*)::INT AS c FROM message_receipts WHERE message_id=$1 AND read_at IS NOT NULL`,
  //       [parent.id]
  //     );
  //     return Number(rows[0]?.c || 0);
  //   }
  // }
};
