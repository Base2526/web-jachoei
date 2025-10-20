// import { query } from "@/lib/db";
// import { pubsub } from "../../../packages/realtime/src/pubsub.js";

import { query } from "@/lib/db";
import { pubsub } from "@/lib/pubsub";

export const resolvers = {
  Query: {
    _health: () => "ok",
    meRole: async (_:any, __:any, ctx:any) => ctx.role || "Subscriber",
    posts: async (_:any, { search }:{search?:string}) => {
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
    post: async (_:any, { id }:{id:string}) => {
      const { rows } = await query(
        `SELECT p.*, row_to_json(u.*) as author_json
         FROM posts p LEFT JOIN users u ON p.author_id = u.id
         WHERE p.id = $1`, [id]
      );
      const r = rows[0]; if (!r) return null;
      return { ...r, author: r.author_json };
    },

    getOrCreateDm: async (_:any, { userId }:{userId:string}) => {

      const { rows:me } = await query(`SELECT id FROM users WHERE email='bob@example.com' LIMIT 1`);
      const meId = me[0]?.id;
      if (!meId) throw new Error("No demo user found");
      const { rows:exist } = await query(
        `SELECT c.* FROM chats c
         JOIN chat_members m1 ON m1.chat_id=c.id AND m1.user_id=$1
         JOIN chat_members m2 ON m2.chat_id=c.id AND m2.user_id=$2
         WHERE c.is_group=false LIMIT 1`, [meId, userId]
      );
      if (exist[0]) return exist[0];
      const { rows:crows } = await query(
        `INSERT INTO chats(is_group, created_by) VALUES(false, $1) RETURNING *`, [meId]
      );
      const chat = crows[0];

      console.log("[getOrCreateDm]" , chat.id, meId, userId);
      // await query(`INSERT INTO chat_members(chat_id, user_id) VALUES ($1,$2),($1,$3)`, [chat.id, meId, userId]);
      return chat;
    },

    messages: async (_:any, { chatId }:{chatId:string}) => {
      const { rows } = await query(
        `SELECT * FROM messages WHERE chat_id=$1 ORDER BY created_at ASC`, [chatId]
      );
      return rows;
    }
  },
  Mutation: {
    upsertPost: async (_:any, { id, data }:{id?:string, data:any}, ctx:any) => {
      const { rows:au } = await query(`SELECT id FROM users WHERE email='bob@example.com' LIMIT 1`);
      const author_id = au[0]?.id;
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
    deletePost: async (_:any, { id }:{id:string}) => {
      const res = await query(`DELETE FROM posts WHERE id=$1`, [id]);
      return res.rowCount === 1;
    },

    sendMessage: async (_:any, { chatId, text }:{chatId:string, text:string}) => {
      const { rows:me } = await query(`SELECT id FROM users WHERE email='bob@example.com' LIMIT 1`);
      const meId = me[0]?.id;
      if (!meId) throw new Error("No demo user found");

      const { rows } = await query(
        `INSERT INTO messages(chat_id, sender_id, text) VALUES ($1,$2,$3) RETURNING *`,
        [chatId, meId, text]
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
