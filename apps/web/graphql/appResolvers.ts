import crypto from "crypto";
import { GraphQLError } from "graphql/error";

import { query } from "@/lib/db";
import { pubsub } from "@/lib/pubsub";

const TOKEN_TTL_DAYS = 7;

export const resolvers = {
  Query: {
    _health: () => "ok",
    meRole: async (_:any, __:any, ctx:any) => ctx.role || "Subscriber",
    posts: async (_:any, { search }:{search?:string}, ctx: any) => {
      if (ctx?.user?.id) {
        const author_id = ctx.user.id;
        console.log("[posts] current user id:", author_id);
      }

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
      if (ctx?.user?.id) {
        const author_id = ctx.user.id;
        console.log("[post] current user id:", author_id);
      }

      const { rows } = await query(
        `SELECT p.*, row_to_json(u.*) as author_json
         FROM posts p LEFT JOIN users u ON p.author_id = u.id
         WHERE p.id = $1`, [id]
      );
      const r = rows[0]; if (!r) return null;
      return { ...r, author: r.author_json };
    },

    getOrCreateDm: async (_:any, { userId }:{userId:string}, ctx: any) => {

      if (!ctx?.user?.id) {
        // throw new Error("Unauthorized");
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      const author_id = ctx.user.id;

      if (!author_id) throw new Error("No demo user found");
      const { rows:exist } = await query(
        `SELECT c.* FROM chats c
         JOIN chat_members m1 ON m1.chat_id=c.id AND m1.user_id=$1
         JOIN chat_members m2 ON m2.chat_id=c.id AND m2.user_id=$2
         WHERE c.is_group=false LIMIT 1`, [author_id, userId]
      );
      if (exist[0]) return exist[0];
      const { rows:crows } = await query(
        `INSERT INTO chats(is_group, created_by) VALUES(false, $1) RETURNING *`, [author_id]
      );
      const chat = crows[0];

      console.log("[getOrCreateDm]" , chat.id, author_id, userId);
      // await query(`INSERT INTO chat_members(chat_id, user_id) VALUES ($1,$2),($1,$3)`, [chat.id, meId, userId]);
      return chat;
    },

    messages: async (_:any, { chatId }:{chatId:string}, ctx: any) => {
      if (!ctx?.user?.id) {
        // throw new Error("Unauthorized");
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      const author_id = ctx.user.id;
      console.log("[messages] current user id:", author_id);

      console.log("[Query]messages : ", chatId)
      const { rows } = await query(
        `SELECT * FROM messages WHERE chat_id=$1 ORDER BY created_at ASC`, [chatId]
      );
      return rows;
    }
  },
  Mutation: {
    login: async (_: any, { input }: { input: { email?: string; username?: string; password: string } }, ctx: any) => {
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
    upsertPost: async (_:any, { id, data }:{id?:string, data:any}, ctx:any) => {
      console.log("[Mutation] upsertPost :", ctx);
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

    sendMessage: async (_:any, { chatId, text }:{chatId:string, text:string}, ctx:any) => {
      if (!ctx?.user?.id) {
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      const author_id = ctx.user.id;

      const { rows } = await query(
        `INSERT INTO messages(chat_id, sender_id, text) VALUES ($1,$2,$3) RETURNING *`,
        [chatId, author_id, text]
      );
      const msg = rows[0];
      await pubsub.publish('MSG:' + chatId, { messageAdded: {
        id: msg.id, chat_id: msg.chat_id, sender_id: msg.sender_id, text: msg.text, ts: (msg.created_at instanceof Date ? msg.created_at.toISOString() : String(msg.created_at))
      }});

      console.log("[sendMessage]", chatId, text );
      return msg;
    }
  }
};
