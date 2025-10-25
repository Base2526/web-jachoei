import crypto from "crypto";
import { GraphQLError } from "graphql/error";

import { query, runInTransaction } from "@/lib/db";
import { pubsub } from "@/lib/pubsub";

const TOKEN_TTL_DAYS = 7;
const topicChat = (chat_id: string) => `MSG_CHAT_${chat_id}`;
const topicUser = (user_id: string) => `MSG_USER_${user_id}`;

function requireAuth(ctx: any): string {
  const uid = ctx?.user?.id;
  if (!uid) {
    throw new GraphQLError("Unauthenticated", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return uid;
}

export const resolvers = {
  Query: {
    _health: () => "ok",
    meRole: async (_:any, __:any, ctx:any) => ctx.role || "Subscriber",
    posts: async (_:any, { search }:{search?:string}, ctx: any) => {
      const author_id = requireAuth(ctx);

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
      const author_id = requireAuth(ctx);

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

    messages: async (_:any, { chat_id, limit=50, offset=0 }:{chat_id:string, limit?:number, offset?:number},  ctx: any) => {
      console.log("[messages] :", ctx);

      const { rows } = await query(
        `SELECT m.*, row_to_json(u.*) as sender_json
         FROM messages m LEFT JOIN users u ON m.sender_id=u.id
         WHERE m.chat_id=$1
         ORDER BY m.created_at ASC
         LIMIT $2 OFFSET $3`, [chat_id, limit, offset]
      );
      return rows.map((r: any)=>({ ...r, sender: r.sender_json, created_at: new Date(r.created_at).toISOString()}));
    },
    users: async (_: any, { search }: { search?: string }, ctx: any) => {

      const author_id = requireAuth(ctx);

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
         WHERE m.chat_id=$2 AND m.sender_id <> $1 AND (r.read_at IS NULL)`,
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

    sendMessage: async (_:any, { chat_id, text, to_user_ids}:{chat_id:string, text:string, to_user_ids: string[]}, ctx:any) => {
      // const me = await currentUserId();

      console.log("[sendMessage] @1 ", chat_id, text);
      if (!ctx?.user?.id) {
        throw new GraphQLError('Unauthenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      const author_id = ctx.user.id;
      const { rows } = await query(
        `INSERT INTO messages (chat_id, sender_id, text) VALUES ($1,$2,$3) RETURNING *`,
        [chat_id, author_id, text]
      );
      const msg = rows[0];
      const senderQ = await query(`SELECT * FROM users WHERE id=$1`, [msg.sender_id]);
      const message = { id: msg.id, chat_id: msg.chat_id, sender: senderQ.rows[0], text: msg.text, created_at: new Date(msg.created_at).toISOString(), to_user_ids };

      await pubsub.publish(topicChat(chat_id), { messageAdded: message });
      await Promise.all(
        to_user_ids.map(uid => pubsub.publish(topicUser(uid), { userMessageAdded: message }))
      );
      console.log("[sendMessage] @2 ", message);
      
      return message;
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
    markMessageRead: async (_:any, { messageId }:{ messageId:string }, ctx:any) => {
      const meId = requireAuth(ctx);
      await query(
        `UPDATE message_receipts
         SET read_at = COALESCE(read_at, NOW())
         WHERE message_id=$1 AND user_id=$2`,
        [messageId, meId]
      );
      return true;
    },
    markChatReadUpTo: async (_:any, { chatId, cursor }:{ chatId:string, cursor:string }, ctx:any) => {
      const meId = requireAuth(ctx);
      await query(
        `UPDATE message_receipts r
         SET read_at = COALESCE(r.read_at, NOW())
         FROM messages m
         WHERE r.message_id = m.id
           AND r.user_id = $1
           AND m.chat_id = $2
           AND m.created_at <= $3::timestamptz`,
        [meId, chatId, cursor]
      );
      return true;
    },
  },

  // Message
  Message: {
    myReceipt: async (parent:any, _args:any, ctx:any) => {

      console.log("[myReceipt]" , ctx);
      
      const meId = requireAuth(ctx);
      const { rows } = await query(
        `SELECT delivered_at, read_at, (read_at IS NOT NULL) AS is_read
         FROM message_receipts
         WHERE message_id=$1 AND user_id=$2`,
        [parent.id, meId]
      );
      const r = rows[0] || null;
      return {
        deliveredAt: r?.delivered_at ? new Date(r.delivered_at).toISOString() : new Date(parent.created_at).toISOString(),
        readAt: r?.read_at ? new Date(r.read_at).toISOString() : null,
        isRead: !!r?.is_read
      };
    },
    readers: async (parent:any) => {
      const { rows } = await query(
        `SELECT u.* FROM message_receipts r
         JOIN users u ON u.id = r.user_id
         WHERE r.message_id=$1 AND r.read_at IS NOT NULL
         ORDER BY r.read_at ASC`,
        [parent.id]
      );
      return rows;
    },
    readersCount: async (parent:any) => {
      const { rows } = await query(
        `SELECT COUNT(*)::INT AS c FROM message_receipts WHERE message_id=$1 AND read_at IS NOT NULL`,
        [parent.id]
      );
      return Number(rows[0]?.c || 0);
    }
  }
};
