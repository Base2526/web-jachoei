import crypto from "crypto";
import { GraphQLError } from "graphql/error";
import bcrypt from 'bcryptjs';
import { query, runInTransaction } from "@/lib/db";
import { pubsub } from "@/lib/pubsub";
import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import path from "path";

import { USER_COOKIE, ADMIN_COOKIE, JWT_SECRET } from "@/lib/auth/token";
import { createResetToken, sendPasswordResetEmail } from "@/lib/passwordReset";
import { buildFileUrlById, persistUploadStream } from "@/lib/storage";
import { requireAuth, sha256Hex } from "@/lib/auth"
import { addLog } from '@/lib/log/log';
import { v4 as uuidv4 } from 'uuid';

import { verifyGoogle, verifyFacebook } from "@/lib/auth/social";
// import { signUserToken } from "@/lib/auth/jwt";

import { GraphQLUpload } from "graphql-upload-nextjs";

import { createNotification } from '@/lib/notifications/service'; 

export const COMMENT_ADDED = 'COMMENT_ADDED';
export const COMMENT_UPDATED = 'COMMENT_UPDATED';
export const COMMENT_DELETED = 'COMMENT_DELETED';
export const NOTI_CREATED   = 'NOTI_CREATED';

export const INCOMING_MESSAGE  = 'INCOMING_MESSAGE';

type GraphQLUploadFile = {
  filename: string;
  mimetype?: string | null;
  encoding?: string | null;
  createReadStream: () => NodeJS.ReadableStream;
};

setInterval(() => {
  const now = new Date().toISOString();

  console.log("[appResolvers.ts][TIME_TICK]");
  pubsub.publish("TIME_TICK", { time: now });

}, 50000);

const TOKEN_TTL_DAYS = 7;
const topicChat = (chat_id: string) => `MSG_CHAT_${chat_id}`;
const topicUser = (user_id: string) => `MSG_USER_${user_id}`;
type Iso = string;

function normalizeStr(input: string): string {
  return input
    .toLowerCase()              // เป็นตัวเล็ก
    .normalize("NFD")           // แยก accent (รองรับไทย/ภาษายุโรป)
    .replace(/[\u0300-\u036f]/g, "") // ลบ accent
    .replace(/[^a-z0-9]+/g, "_") // อะไรที่ไม่ใช่ a-z 0-9 → _
    .replace(/_+/g, "_")         // แทน _ ซ้อนหลายตัวด้วย _
    .replace(/^_+|_+$/g, "");    // ตัด _ หน้า/หลัง
}

async function getUserById(id: string) {
  const { rows } = await query(
    `SELECT * FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    _health: () => "ok",
    me: async (_: any, {  }: { }, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] me :", author_id);

      const { rows } = await query(`SELECT * FROM users WHERE id=$1 LIMIT 1`, [author_id]);
      return rows[0];
    },
    meRole: async (_:any, __:any, ctx:any) => ctx.role || "Subscriber",
    // resolver: posts
    posts: async (_: any, { search }: { search?: string }, ctx: any) => {
      const author_id = requireAuth(ctx, { optionalWeb: true });
      console.log("[Query] posts :", author_id);

      const params: any[] = [];
      let sql = `
        SELECT
          p.*,
          row_to_json(u) AS author_json,

          -- images
          (
            SELECT COALESCE(json_agg(json_build_object('id', f.id, 'relpath', f.relpath)), '[]'::json)
            FROM post_images pi
            JOIN files f ON f.id = pi.file_id
            WHERE pi.post_id = p.id
          ) AS images,

          -- bookmarks
          COALESCE(
            JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT('user_id', bm.user_id))
            FILTER (WHERE bm.user_id IS NOT NULL),
            '[]'::JSONB
          ) AS bookmarks

        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN bookmarks bm ON bm.post_id = p.id
      `;

      if (search) {
        sql += ` WHERE p.title ILIKE $1 OR p.phone ILIKE $1 `;
        params.push(`%${search}%`);
      }

      sql += ` GROUP BY p.id, u.id ORDER BY p.created_at DESC`;

      const { rows } = await query(sql, params);

      return rows.map((r: any) => ({
        ...r,
        author: r.author_json,
        images: (r.images || []).map((it: any) => ({
          id: it.id,
          url: buildFileUrlById(it.id),
        })),
        bookmarks: r.bookmarks || [],
        isBookmarked:
          Array.isArray(r.bookmarks) && author_id
            ? r.bookmarks.some((b: any) => b.user_id === author_id)
            : false,
      }));
    },
    postsPaged: async (_: any, { search, limit, offset }: { search?: string; limit: number; offset: number }, ctx: any) => {
      const author_id = requireAuth(ctx, { optionalWeb: true });
      console.log("[Query] postsPaged :", author_id);

      const params: any[] = [];
      let whereSql = '';

      /* --------------------------------------
      * 🔎 SEARCH: title, phone, bank account
      * -------------------------------------- */
      if (search) {
        params.push(`%${search}%`); // $1
        const idx = params.length;

        whereSql = `
          WHERE (
            p.title ILIKE $${idx}
            OR EXISTS (
              SELECT 1 FROM post_tel_numbers t
              WHERE t.post_id = p.id
              AND t.tel ILIKE $${idx}
            )
            OR EXISTS (
              SELECT 1 FROM post_seller_accounts s
              WHERE s.post_id = p.id
              AND (
                s.seller_account ILIKE $${idx}
                OR s.bank_name ILIKE $${idx}
                OR s.bank_id ILIKE $${idx}
              )
            )
          )
        `;
      }

      /* --------------------------------------
      * 💡 ALWAYS enforce public status
      * -------------------------------------- */
      if (whereSql.trim() === '') {
        whereSql = `WHERE p.status = 'public'`;
      } else {
        whereSql += ` AND p.status = 'public'`;
      }

      /* --------------------------------------
      * ⭐ is_bookmarked (current user)
      * -------------------------------------- */
      let isBookmarkedSelect = `false AS is_bookmarked`;
      if (author_id) {
        params.push(author_id);
        const meIdx = params.length;

        isBookmarkedSelect = `
          EXISTS (
            SELECT 1 FROM bookmarks bm
            WHERE bm.post_id = p.id
              AND bm.user_id = $${meIdx}
          ) AS is_bookmarked
        `;
      }

      /* --------------------------------------
      * LIMIT / OFFSET
      * -------------------------------------- */
      params.push(limit, offset);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const sql = `
        SELECT
          COUNT(*) OVER() AS total,
          p.*,
          row_to_json(u) AS author_json,

          -- images
          (
            SELECT json_agg(json_build_object('id', f.id, 'relpath', f.relpath) ORDER BY pi.id)
            FROM post_images pi
            JOIN files f ON f.id = pi.file_id
            WHERE pi.post_id = p.id
          ) AS images_json,

          -- tel numbers
          (
            SELECT json_agg(json_build_object('id', t.id, 'tel', t.tel) ORDER BY t.created_at)
            FROM post_tel_numbers t
            WHERE t.post_id = p.id
          ) AS tel_numbers_json,

          -- seller accounts
          (
            SELECT json_agg(
              json_build_object(
                'id', s.id,
                'bank_id', s.bank_id,
                'bank_name', s.bank_name,
                'seller_account', s.seller_account
              )
              ORDER BY s.created_at
            )
            FROM post_seller_accounts s
            WHERE s.post_id = p.id
          ) AS seller_accounts_json,

          -- 🔢 comments count
          (
            SELECT COUNT(*)
            FROM comments c
            WHERE c.post_id = p.id
          ) AS comments_count,

          -- is_bookmarked
          ${isBookmarkedSelect}

        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        ${whereSql}
        ORDER BY p.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const { rows } = await query(sql, params);
      const total = rows[0]?.total ? Number(rows[0].total) : 0;

      const items = rows.map((r: any) => ({
        ...r,
        author: r.author_json,
        images: (r.images_json || []).map((it: any) => ({
          id: it.id,
          url: buildFileUrlById(it.id),
        })),
        tel_numbers: (r.tel_numbers_json || []).map((t: any) => ({
          id: t.id,
          tel: t.tel,
        })),
        seller_accounts: (r.seller_accounts_json || []).map((s: any) => ({
          id: s.id,
          bank_id: s.bank_id,
          bank_name: s.bank_name,
          seller_account: s.seller_account,
        })),
        comments_count: Number(r.comments_count || 0),
        is_bookmarked: !!r.is_bookmarked,
      }));

      return { items, total };
    },
    post: async (_: any, { id }: { id: string }, ctx: any) => {
      const author_id = requireAuth(ctx, { optionalWeb: true }); // อนุญาตไม่ล็อกอินได้
      console.log("[Query] post :", author_id);

      // ใช้ $2 เป็น user id (อาจเป็น null)
      const { rows } = await query(
        `
        SELECT
          p.*,
          row_to_json(u) AS author_json,
          pr.name_th AS province_name,
          -- ✅ คำนวณ is_bookmarked แบบไม่เป็น null
          CASE
            WHEN $2::uuid IS NULL THEN false
            ELSE EXISTS (
              SELECT 1 FROM bookmarks b
              WHERE b.post_id = p.id AND b.user_id = $2::uuid
            )
          END AS is_bookmarked
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN provinces pr ON pr.id = p.province_id
        WHERE p.id = $1 
        `,
        [id, author_id ?? null]
      );
      const r = rows[0];
      if (!r) return null;

      const { rows: imgs } = await query(
        `
        SELECT f.id, f.relpath
        FROM post_images pi
        JOIN files f ON f.id = pi.file_id
        WHERE pi.post_id = $1
        ORDER BY pi.id
        `,
        [id]
      );

      const { rows: telNumbers } = await query(
        `
        SELECT id, tel, created_at
        FROM post_tel_numbers
        WHERE post_id = $1
        ORDER BY created_at ASC
        `,
        [id]
      );

      const { rows: sellerAccounts } = await query(
        `
        SELECT id, bank_id, bank_name, seller_account, created_at
        FROM post_seller_accounts
        WHERE post_id = $1
        ORDER BY created_at ASC
        `,
        [id]
      );

      return {
        ...r,
        author: r.author_json,
        province_name: r.province_name || null,
        is_bookmarked: !!r.is_bookmarked,           
        images: (imgs || []).map((it: any) => ({
          id: it.id,
          url: buildFileUrlById(it.id),
        })),
        tel_numbers: telNumbers || [],
        seller_accounts: sellerAccounts || [],
      };
    },
    myPosts: async (_:any, { search }:{search?:string}, ctx:any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] myPosts :", ctx, author_id);

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
      console.log("[Query] getOrCreateDm :", ctx, author_id);

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
    myChats: async (_: any, { }: {}, ctx: any) => {
      const author_id = requireAuth(ctx);

      const { rows } = await query(
        `
        SELECT
          c.*,
          row_to_json(uc.*) AS creator_json,

          -- last message + images
          (
            SELECT json_build_object(
              'id', lm.id,
              'chat_id', lm.chat_id,
              'text', lm.text,
              'created_at', lm.created_at,
              'sender_id', lm.sender_id,
              'images',
              (
                SELECT COALESCE(json_agg(row_to_json(mi.*)), '[]'::json)
                FROM message_images mi
                WHERE mi.message_id = lm.id
              )
            )
            FROM messages lm
            WHERE lm.chat_id = c.id
            ORDER BY lm.created_at DESC
            LIMIT 1
          ) AS last_message_json

        FROM chats c
        LEFT JOIN users uc ON c.created_by = uc.id
        WHERE EXISTS (
          SELECT 1
          FROM chat_members m
          WHERE m.chat_id = c.id AND m.user_id = $1
        )
        ORDER BY c.created_at DESC
        `,
        [author_id]
      );

      const out: any[] = [];

      for (const c of rows) {
        const mem = await query(
          `
          SELECT 
            u.id, u.name, u.avatar, u.phone, u.email,
            u.role, u.created_at, u.username, u.language
          FROM chat_members m
          JOIN users u ON m.user_id = u.id
          WHERE m.chat_id = $1
          `,
          [c.id]
        );

        let lastMessage = null;
        let lastMessageAt: string | null = null;

        if (c.last_message_json) {
          const lm = c.last_message_json;

          lastMessageAt = lm.created_at;//new Date(lm.created_at).toISOString();

          // แปลง images ให้เป็น array เสมอ
          const rawImages = Array.isArray(lm.images) ? lm.images : [];

          lastMessage = {
            id: lm.id,
            chat_id: lm.chat_id,
            text: lm.text || "",
            created_at: lastMessageAt,
            sender_id: lm.sender_id,

            images: rawImages.map((img: any) => ({
              id: img.id,
              url: img.url,
              file_id: img.file_id ?? null,
              mime: img.mime ?? null,
              width: img.width ?? null,
              height: img.height ?? null,
            })),

            // ฟิลด์อื่น ๆ เดี๋ยวให้ resolver ของ Message จัดการต่อ
            to_user_ids: [],
            is_deleted: false,
            deleted_at: null,
            myReceipt: null,
            readers: [],
            readersCount: 0,
          };
        }

        out.push({
          id: c.id,
          name: c.name,
          is_group: c.is_group,
          created_at: new Date(c.created_at).toISOString(),
          created_by: c.creator_json,
          members: mem.rows,
          last_message: lastMessage,
          last_message_at: lastMessageAt,
        });
      }
      // console.log("[Query] myChats :", out);
      return out;
    },
    myBookmarks: async (_: any, { limit = 20, offset = 0 }: any, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] myBookmarks :", ctx, author_id);

      const { rows } = await query(
        `
        SELECT p.*, row_to_json(u) AS author_json,
               (
                 SELECT json_agg(json_build_object('id', f.id, 'relpath', f.relpath))
                 FROM post_images pi
                 JOIN files f ON f.id = pi.file_id
                 WHERE pi.post_id = p.id
               ) AS images_json
        FROM bookmarks b
        JOIN posts p ON b.post_id = p.id
        LEFT JOIN users u ON p.author_id = u.id
        WHERE b.user_id = $1
        ORDER BY b.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [author_id, limit, offset]
      );

      return rows.map((r: any) => ({
        ...r,
        author: r.author_json,
        images: (r.images_json || []).map((it: any) => ({
          id: it.id,
          url: buildFileUrlById(it.id),
        })),
        is_bookmarked: true
      }));
    },
    messages: async (
      _: any,
      {
        chat_id,
        limit = 50,
        offset = 0,
        includeDeleted = false,
      }: {
        chat_id: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
      },
      ctx: any
    ) => {
      const author_id = requireAuth(ctx);

      console.log("[Query] messages :", author_id, limit, offset);

      const filter = includeDeleted ? "" : "AND m.deleted_at IS NULL";

      // ===== MAIN MESSAGE FETCH =====
      const { rows } = await query(
        `
        SELECT
          m.*,
          (m.deleted_at IS NOT NULL) AS is_deleted,
          row_to_json(u.*) AS sender_json,

          (
            SELECT COALESCE(json_agg(row_to_json(mi.*)), '[]'::json)
            FROM message_images mi
            WHERE mi.message_id = m.id
          ) AS images_json,

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

          (
            SELECT COALESCE(json_agg(row_to_json(ru.*) ORDER BY r2.read_at ASC), '[]'::json)
            FROM message_receipts r2
            JOIN users ru ON ru.id = r2.user_id
            WHERE r2.message_id = m.id AND r2.read_at IS NOT NULL
          ) AS readers_json,

          (
            SELECT COUNT(*)::INT
            FROM message_receipts r3
            WHERE r3.message_id = m.id AND r3.read_at IS NOT NULL
          ) AS readers_count

        FROM messages m
        LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.chat_id = $1 ${filter}
        ORDER BY m.created_at DESC
        LIMIT $3 OFFSET $4
        `,
        [chat_id, author_id, limit, offset]
      );

      // ===== FETCH all reply_to messages =====
      const replyIds = rows
        .map((r: any) => r.reply_to_id)
        .filter((x: any) => !!x);

      let replyMap: Record<string, any> = {};

      if (replyIds.length > 0) {
        const replyQuery = await query(
          `
          SELECT
            m.*,
            row_to_json(u.*) AS sender_json,
            (
              SELECT COALESCE(json_agg(row_to_json(mi.*)), '[]'::json)
              FROM message_images mi
              WHERE mi.message_id = m.id
            ) AS images_json
          FROM messages m
          LEFT JOIN users u ON u.id = m.sender_id
          WHERE m.id = ANY($1::uuid[])
          `,
          [replyIds]
        );

        replyQuery.rows.forEach((m: any) => {
          replyMap[m.id] = {
            id: m.id,
            text: m.text,
            sender: m.sender_json,
            images: Array.isArray(m.images_json)
              ? m.images_json.map((i: any) => ({
                  id: i.id,
                  url: i.url,
                  file_id: i.file_id ?? null,
                  mime: i.mime ?? null,
                  width: i.width ?? null,
                  height: i.height ?? null,
                }))
              : [],
          };
        });
      }

      // ===== PACK FINAL RESULTS =====
      const results = rows.map((r: any) => {
        const createdISO = new Date(r.created_at).toISOString();
        const mr = r.my_receipt_json || null;

        return {
          id: r.id,
          chat_id: r.chat_id,
          created_at: createdISO,
          sender: r.sender_json,

          images: Array.isArray(r.images_json)
            ? r.images_json.map((img: any) => ({
                id: img.id,
                url: img.url,
                file_id: img.file_id,
                mime: img.mime || null,
                width: img.width || null,
                height: img.height || null,
              }))
            : [],

          text: r.is_deleted ? "" : r.text,
          to_user_ids: r.to_user_ids || [],

          myReceipt: {
            deliveredAt: mr?.delivered_at
              ? new Date(mr.delivered_at).toISOString()
              : createdISO,
            readAt: mr?.read_at ? new Date(mr.read_at).toISOString() : null,
            isRead: !!mr?.is_read,
          },

          readers: Array.isArray(r.readers_json) ? r.readers_json : [],
          readersCount: Number(r.readers_count) || 0,

          is_deleted: r.is_deleted ?? false,
          deleted_at: r.deleted_at ? new Date(r.deleted_at).toISOString() : null,

          reply_to_id: r.reply_to_id || null,
          reply_to: r.reply_to_id ? replyMap[r.reply_to_id] : null,
        };
      });

      console.log("[Query] messages", chat_id, results.length);
      return results;
    },
    users: async (_: any, { search }: { search?: string }, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] users :", author_id);

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
    user: async (_: any, { id }: { id: string }, ctx: any) => {
      const author_id = requireAuth(ctx, { optionalWeb: true });
      console.log("[Query] user", id, author_id);

      return await getUserById(id);
    },
    postsByUserId: async (_: any, { user_id }: { user_id: string }, ctx: any) => {
      const author_id = requireAuth(ctx, { optionalWeb: true });
      console.log("[Query] postsByUserId :", author_id, "target:", user_id);

      const params: any[] = [user_id];
      const sql = `
        SELECT
          p.*,
          row_to_json(u) AS author_json,

          -- tel_numbers
          (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', t.id,
                  'tel', t.tel
                )
              ),
              '[]'::json
            )
            FROM post_tel_numbers t
            WHERE t.post_id = p.id
          ) AS tel_numbers,

          -- seller_accounts
          (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', sa.id,
                  'bank_id', sa.bank_id,
                  'bank_name', sa.bank_name,
                  'seller_account', sa.seller_account
                )
              ),
              '[]'::json
            )
            FROM post_seller_accounts sa
            WHERE sa.post_id = p.id
          ) AS seller_accounts,

          -- images
          (
            SELECT COALESCE(
              json_agg(
                json_build_object('id', f.id, 'relpath', f.relpath)
              ),
              '[]'::json
            )
            FROM post_images pi
            JOIN files f ON f.id = pi.file_id
            WHERE pi.post_id = p.id
          ) AS images,

          -- bookmarks
          COALESCE(
            JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT('user_id', bm.user_id))
            FILTER (WHERE bm.user_id IS NOT NULL),
            '[]'::JSONB
          ) AS bookmarks

        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN bookmarks bm ON bm.post_id = p.id
        WHERE p.author_id = $1
        GROUP BY p.id, u.id
        ORDER BY p.created_at DESC
      `;

      const { rows } = await query(sql, params);

      return rows.map((r: any) => ({
        ...r,
        author: r.author_json,
        images: (r.images || []).map((it: any) => ({
          id: it.id,
          url: buildFileUrlById(it.id),
        })),

        // ✅ ไม่ให้เป็น null
        tel_numbers: (r.tel_numbers || []).map((it: any) => ({
          id: it.id,
          tel: it.tel,
        })),

        seller_accounts: (r.seller_accounts || []).map((it: any) => ({
          id: it.id,
          bank_id: it.bank_id,
          bank_name: it.bank_name,
          seller_account: it.seller_account,
        })),

        bookmarks: r.bookmarks || [],
        isBookmarked:
          Array.isArray(r.bookmarks) && author_id
            ? r.bookmarks.some((b: any) => b.user_id === author_id)
            : false,
      }));
    },
    unreadCount: async (_:any, { chatId }:{ chatId: string }, ctx:any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] unreadCount :", author_id);

      const { rows } = await query(
        `SELECT unread_count FROM chat_unread_counts WHERE user_id=$1 AND chat_id=$2`,
        [author_id, chatId]
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
        [author_id, chatId]
      );
      return Number(rows2[0]?.unread_count || 0);
    },
    whoRead: async (_:any, { messageId }:{messageId:string}, ctx:any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] whoRead :", author_id);

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
      const author_id = requireAuth(ctx);
      console.log("[Query] stats :", author_id);

      const results = await Promise.all([
        query(`SELECT COUNT(*)::int AS c FROM users`),
        query(`SELECT COUNT(*)::int AS c FROM posts`),
        query(`SELECT COUNT(*)::int AS c FROM files WHERE deleted_at IS NULL`),
        query(`SELECT COUNT(*)::int AS c FROM system_logs`),
      ]);

      const [users, posts, files, logs] = results.map(( r:any)=> r.rows[0].c);

      return { users, posts, files, logs };
    },
    latestUsers: async (_: any, { limit = 5 }: any, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] latestUsers :", author_id);

      const { rows } = await query(
        `SELECT id, name, email, role, created_at, avatar
        FROM users
        ORDER BY created_at DESC
        LIMIT $1`,
        [limit]
      );

      return rows.map((u: any) => ({
        ...u,
        avatar: u.avatar || null, // ถ้าไม่มีค่าให้เป็น null
      }));
    },
    latestPosts: async (_: any, { limit = 5 }: any, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] latestPosts :", author_id);

      const { rows } = await query(
        `
        SELECT 
          p.id, p.title, p.status, p.created_at,
          (
            SELECT json_agg(json_build_object('id', f.id, 'relpath', f.relpath) ORDER BY pi.id)
            FROM post_images pi
            JOIN files f ON f.id = pi.file_id
            WHERE pi.post_id = p.id
          ) AS images_json
        FROM posts p
        ORDER BY p.created_at DESC
        LIMIT $1
        `,
        [limit]
      );

      return rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        created_at: r.created_at,
        images: (r.images_json || []).map((it: any) => ({
          id: it.id,
          url: buildFileUrlById(it.id),
        })),
      }));
    },
    pending: async (_:any, __:any, ctx:any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] pending :", author_id);

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
    filesPaged: async (_: any, { search, limit, offset }: any, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Query] pending :", author_id);

      const params: any[] = [];
      let where = '';
      if (search && search.trim()) {
        params.push(`%${search}%`);
        where = `WHERE f.original_name ILIKE $${params.length} OR f.filename ILIKE $${params.length}`;
      }
      params.push(limit, offset);

      const sql = `
        SELECT
          COUNT(*) OVER() AS total,
          f.*
        FROM files f
        ${where}
        ORDER BY f.created_at DESC
        LIMIT $${params.length-1} OFFSET $${params.length}
      `;
      const { rows } = await query(sql, params);
      const total = rows[0]?.total ? Number(rows[0].total) : 0;

      const items = rows.map((r: any) => ({
        ...r,
        url: buildFileUrlById(r.id),
        thumb: r.mimetype && r.mimetype.startsWith('image/')
          ? buildFileUrlById(r.id)
          : null,
      }));

      return { items, total };
    },

    // 
    myNotifications: async (
      _: any,
      args: { limit?: number; offset?: number },
      ctx: any
    ) => {
      const user = ctx.user; // สมมติ auth middleware ใส่มาแล้ว
      if (!user) throw new Error('Unauthorized');

      const limit = args.limit ?? 20;
      const offset = args.offset ?? 0;

      const { rows } = await query(
        `
        SELECT
          id,
          user_id,
          type,
          title,
          message,
          entity_type,
          entity_id,
          data,
          is_read,
          created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        OFFSET $3
        `,
        [user.id, limit, offset]
      );

      return rows;
    },
    myUnreadNotificationCount: async (_: any, __: any, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('Unauthorized');

      const { rows } = await query(
        `
        SELECT COUNT(*)::int AS count
        FROM notifications
        WHERE user_id = $1
          AND is_read = FALSE
        `,
        [user.id]
      );

      return rows[0]?.count ?? 0;
    },
    comments: async (_: any, { post_id }: { post_id: string }) => {
      const { rows } = await query(
        `
        SELECT
          c.id,
          c.post_id,
          c.user_id,
          c.parent_id,
          c.content,
          c.created_at,
          c.updated_at,
          u.id   AS u_id,
          u.name AS u_name,
          u.avatar AS u_avatar
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC
        `,
        [post_id]
      );

      // สร้าง comment object พร้อม user + replies array
      const byId = new Map<string, any>();

      for (const r of rows) {
        const comment = {
          id: r.id,
          post_id: r.post_id,
          user_id: r.user_id,
          parent_id: r.parent_id,
          content: r.content,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : null, // r.created_at,
          updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null, // r.updated_at,
          user: {
            id: r.u_id,
            name: r.u_name,
            avatar: r.u_avatar,
          },
          replies: [] as any[],
        };

        byId.set(comment.id, comment);
      }

      // ประกอบ tree: ใครมี parent_id ก็ใส่เข้า replies ของ parent
      const roots: any[] = [];

      for (const comment of byId.values()) {
        if (comment.parent_id && byId.has(comment.parent_id)) {
          const parent = byId.get(comment.parent_id);
          parent.replies.push(comment);
        } else {
          roots.push(comment);
        }
      }

      return roots;
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

    loginWithSocial: async (_: any, { input }: any, ctx: any) => {
      const { provider, accessToken } = input;

      let socialData = null;

      if (provider === "google") {
        socialData = await verifyGoogle(accessToken);
      } else if (provider === "facebook") {
        socialData = await verifyFacebook(accessToken);
      } else {
        throw new GraphQLError("Invalid provider");
      }

      if (!socialData) {
        throw new GraphQLError("Social token invalid");
      }

      const { email, name, picture, provider_id } = socialData;

      /* ======================================================
            1) หา user ถ้ามี email อยู่แล้ว → login เลย
         ====================================================== */
      const { rows: existing } = await query(
        `SELECT * FROM users WHERE email = $1 LIMIT 1`,
        [email]
      );

      let user = existing[0];

      /* ======================================================
            2) ถ้ายังไม่มี user → สร้างใหม่
         ====================================================== */
      if (!user) {
        const randomPassword = crypto.randomBytes(16).toString("hex");

        const { rows: newUser } = await query(
          `
          INSERT INTO users (name, username, email, avatar, role, password_hash, provider, provider_id, meta)
          VALUES ($1,$2,$3,$4,'Subscriber', crypt($5, gen_salt('bf')),$6,$7,$8)
          RETURNING *
        `,
          [name, normalizeStr(email), email, picture, randomPassword, provider, provider_id, JSON.stringify(socialData || {})]
        );

        user = newUser[0];
      }

      /*
      web-1       | [loginWithSocial] @1 =  {
      web-1       |   email: 'android.somkid@gmail.com',
      web-1       |   name: 'Somkid Simajarn',
      web-1       |   picture: 'https://lh3.googleusercontent.com/a/ACg8ocJ1XvMZgNQRmpi7ceC4dIhQMd6f2AumSMhVvTXilWF8y7hVkJ8b=s96-c',
      web-1       |   provider: 'google',
      web-1       |   provider_id: '112378752153101585347'
      web-1       | }
      */

      /*
      web-1       | [loginWithSocial] =  {
      web-1       |   id: 'c2570057-d8bd-4506-9f00-0c7fc6996d52',
      web-1       |   name: 'Somkid Simajarn',
      web-1       |   avatar: 'https://lh3.googleusercontent.com/a/ACg8ocJ1XvMZgNQRmpi7ceC4dIhQMd6f2AumSMhVvTXilWF8y7hVkJ8b=s96-c',
      web-1       |   phone: null,
      web-1       |   email: 'android.somkid@gmail.com',
      web-1       |   role: 'Subscriber',
      web-1       |   created_at: 2025-11-13T16:57:50.060Z,
      web-1       |   password_hash: '$2a$06$owU1d10euSYJdLhqxZGyFekkLyJzgz9eIox9c7mv1pwGHRmvyTk0a',
      web-1       |   meta: null,
      web-1       |   fake_test: null,
      web-1       |   username: null,
      web-1       |   language: 'en',
      web-1       |   updated_at: 2025-11-13T16:57:50.060Z
      web-1       | }
      */

      /* ======================================================
            3) ออก JWT token
         ====================================================== */
         /*
      const token = signUserToken(user);

      return jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        JWT_SECRET,
        { expiresIn: "30d" }
      );
      */

      //  id: user.id, email: user.email, role: user.role

      console.log("[loginWithSocial] @1 = ", socialData);
      console.log("[loginWithSocial] @2 = ", user);

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      cookies().set(USER_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });

      // แนะนำ: set cookie httpOnly ใน production
      // ctx.res.cookie("token", token, {
      //   httpOnly: true,
      //   sameSite: 'lax',
      //   path: '/'
      // });


      return {
        ok: true,
        message: "Login success",
        token,
        user,
      };
    },
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
    registerUser: async(_: any, { input }: any) => {
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
    requestPasswordReset: async(_: any, { email }: { email: string }, ctx: any)=>{
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
    resetPassword: async(_: any, { token, newPassword }: { token: string; newPassword: string }, ctx: any)=>{
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

    // resolver ตัวอย่าง
    updateMe: async (_:any, { data }: { data: any }, ctx:any) => {
      const uid = requireAuth(ctx); // ต้องล็อกอิน
      const { name, email, phone, username, language } = data;

      console.log("[Mutation] updateMe :", name, email, phone, username, language );
      const { rows } = await query(
        `UPDATE users SET
          name = COALESCE($1, name),
          email = COALESCE($2, email),
          phone = COALESCE($3, phone),
          username = COALESCE($4, username),
          language = COALESCE($5, language),
          updated_at = NOW()
        WHERE id = $6
        RETURNING id, name, email, phone, username, language, avatar`,
        [name, email, phone, username, language, uid]
      );
      return rows[0];
    },
    upsertPost: async (
      _: any,
      { id, data, images, image_ids_delete }: {
        id?: string;
        data: any;
        images?: Array<Promise<GraphQLUploadFile>>;
        image_ids_delete?: Array<string | number>;
      },
      ctx: any
    ) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] upsertPost :", author_id, data, image_ids_delete);

      return runInTransaction(author_id, async (client) => {
        let postId: string;

        // ============================================================
        // 1) UPSERT POSTS
        // ============================================================
        const commonFields = [
          data.first_last_name || null,
          data.id_card || null,
          data.title || null,
          data.transfer_amount || 0,
          data.transfer_date ? new Date(data.transfer_date) : null,
          data.website || null,
          data.province_id || null,
          data.detail || null,
          data.status || "public",
        ];

        if (id) {
          const { rows } = await client.query(
            `UPDATE posts
              SET first_last_name=$1, id_card=$2, title=$3,
                  transfer_amount=$4, transfer_date=$5, website=$6,
                  province_id=$7, detail=$8, status=$9,
                  updated_at=NOW()
            WHERE id=$10
            RETURNING id`,
            [...commonFields, id]
          );
          postId = rows[0].id;
        } else {
          const { rows } = await client.query(
            `INSERT INTO posts (
              first_last_name, id_card, title,
              transfer_amount, transfer_date, website,
              province_id, detail,
              status, author_id, created_at, updated_at
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()
            )
            RETURNING id`,
            [...commonFields, author_id]
          );
          postId = rows[0].id;
        }

        // ============================================================
        // 2) TEL NUMBERS (insert/update/delete)
        // ============================================================
        if (Array.isArray(data.tel_numbers)) {
          for (const tel of data.tel_numbers) {
            if (tel.mode === "deleted") {
              await client.query(`DELETE FROM post_tel_numbers WHERE id=$1 AND post_id=$2`, [tel.id, postId]);
            } else if (tel.mode === "edited") {
              await client.query(
                `UPDATE post_tel_numbers SET tel=$1 WHERE id=$2 AND post_id=$3`,
                [tel.tel, tel.id, postId]
              );
            } else if (tel.mode === "new") {
              await client.query(
                `INSERT INTO post_tel_numbers (post_id, tel)
                VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [postId, tel.tel]
              );
            }
          }
        }

        // ============================================================
        // 3) SELLER ACCOUNTS (insert/update/delete)
        // ============================================================
        if (Array.isArray(data.seller_accounts)) {
          for (const acc of data.seller_accounts) {
            if (acc.mode === "deleted") {
              await client.query(`DELETE FROM post_seller_accounts WHERE id=$1 AND post_id=$2`, [acc.id, postId]);
            } else if (acc.mode === "edited") {
              await client.query(
                `UPDATE post_seller_accounts
                  SET bank_id=$1, bank_name=$2, seller_account=$3
                WHERE id=$4 AND post_id=$5`,
                [acc.bank_id, acc.bank_name, acc.seller_account || "", acc.id, postId]
              );
            } else if (acc.mode === "new") {
              await client.query(
                `INSERT INTO post_seller_accounts (post_id, bank_id, bank_name, seller_account)
                VALUES ($1,$2,$3,$4)
                ON CONFLICT DO NOTHING`,
                [postId, acc.bank_id, acc.bank_name, acc.seller_account || ""]
              );
            }
          }
        }

        // ============================================================
        // 4) ลบรูปเก่า (ถ้ามี)
        // ============================================================
        if (image_ids_delete?.length) {
          await client.query(
            `DELETE FROM post_images WHERE post_id = $1 AND file_id = ANY($2::int[])`,
            [postId, image_ids_delete.map((id: any) => parseInt(id, 10))]
          );
        }

        // ============================================================
        // 5) เพิ่มรูปใหม่ (stream)
        // ============================================================
        if (images?.length) {
          const fileRows: any[] = [];

          for (const pf of images) {
            const upload = await pf; // GraphQLUploadFile

            const ext = path.extname(upload.filename || "");
            const renameTo = `post-${postId}-${Date.now()}${ext || ""}`;

            const row = await persistUploadStream(upload, renameTo);
            fileRows.push(row);
          }

          if (fileRows.length) {
            const values = fileRows.map((_, i) => `($1, $${i + 2})`).join(", ");
            await client.query(
              `INSERT INTO post_images (post_id, file_id) VALUES ${values}`,
              [postId, ...fileRows.map((r) => r.id)]
            );
          }
        }

        // ============================================================
        // 6) ดึงข้อมูลโพสต์กลับพร้อมรูป
        // ============================================================
        const { rows: posts } = await client.query(`SELECT * FROM posts WHERE id=$1`, [postId]);
        const { rows: imgs } = await client.query(
          `SELECT f.id, f.relpath
            FROM post_images pi
            JOIN files f ON f.id = pi.file_id
            WHERE pi.post_id=$1
            ORDER BY pi.id`,
          [postId]
        );

        // ============================================================
        // 7) LOG
        // ============================================================
        await addLog(
          "info",
          id ? "post-update" : "post-create",
          id ? "User updated a post" : "User created a post",
          { author_id, postId }
        );

        // ============================================================
        // RETURN
        // ============================================================
        return {
          ...posts[0],
          images: imgs.map((r: any) => ({
            id: r.id,
            url: buildFileUrlById(r.id),
          })),
        };


      });
    },
    deletePost: async (_:any, { id }:{id:string}, ctx:any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] deletePost :", ctx, author_id);

      // ✅ ใช้ helper transaction function
      return await runInTransaction(author_id, async (client) => {
        // ลบโพสต์ใน transaction
        const res = await client.query(`DELETE FROM posts WHERE id = $1`, [id]);

        // ✅ บันทึก log หลังลบสำเร็จ (อยู่ใน transaction เดียวกัน)
        await addLog('info', 'post-delete', 'User deleted post', {
          author_id,
          postId: id,
          affectedRows: res.rowCount,
        });

        return res.rowCount === 1;
      });
    },
    deletePosts: async (_: any, { ids }: { ids: string[] }, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] deletePosts :", ctx, author_id);

      // ✅ validate input
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new GraphQLError("No IDs provided", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const validIds = ids.filter((id) => /^[0-9a-fA-F-]{36}$/.test(id));
      if (validIds.length === 0) {
        throw new GraphQLError("Invalid UUIDs", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // ✅ ทำงานใน transaction พร้อมตั้งค่า app.editor_id
      const result = await runInTransaction(author_id, async (client) => {
        // 1) ลบโพสต์
        const res = await client.query(
          `DELETE FROM posts WHERE id = ANY($1::uuid[])`,
          [validIds]
        );

        // 2) เพิ่ม log
        await addLog(
          "info",                     // log level
          "post-delete",              // action key
          `Deleted ${res.rowCount} posts`, // message
          {
            userId: author_id,
            deletedCount: res.rowCount,
            postIds: validIds,
          }
        );

        return res.rowCount > 0;
      });

      return result;
    },
    clonePost: async (
      _: any,
      { id }: { id: string },
      ctx: any
    ) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] clonePost :", author_id, id);

      return runInTransaction(author_id, async (client) => {
        // ==================================
        // 1) หา source post
        // ==================================
        const { rows: srcPosts } = await client.query(
          `SELECT *
          FROM posts
          WHERE id = $1`,
          [id]
        );
        if (!srcPosts.length) {
          throw new Error("Source post not found");
        }
        const src = srcPosts[0];

        // ==================================
        // 2) insert post ใหม่
        // ==================================
        const { rows: newPostRows } = await client.query(
          `INSERT INTO posts (
            first_last_name,
            id_card,
            title,
            transfer_amount,
            transfer_date,
            website,
            province_id,
            detail,
            status,
            author_id,
            created_at,
            updated_at
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()
          )
          RETURNING id`,
          [
            src.first_last_name,
            src.id_card,
            (src.title || "") + " Clone",
            src.transfer_amount,
            src.transfer_date,
            src.website,
            src.province_id,
            src.detail,
            src.status,
            author_id,
          ]
        );

        const newPostId = newPostRows[0].id;

        // ==================================
        // 3) clone tel_numbers
        // ==================================
        const { rows: srcTels } = await client.query(
          `SELECT tel FROM post_tel_numbers WHERE post_id=$1`,
          [id]
        );
        if (srcTels.length) {
          const values = srcTels.map((_:any, i:any) => `($1, $${i + 2})`).join(", ");
          await client.query(
            `INSERT INTO post_tel_numbers (post_id, tel)
            VALUES ${values}`,
            [newPostId, ...srcTels.map((r:any) => r.tel)]
          );
        }

        // ==================================
        // 4) clone seller_accounts
        // ==================================
        const { rows: srcAccs } = await client.query(
          `SELECT bank_id, bank_name, seller_account
          FROM post_seller_accounts
          WHERE post_id=$1`,
          [id]
        );
        if (srcAccs.length) {
          const values = srcAccs
            .map((_:any, i:any) => {
              const base = 1 + i * 3;
              return `($1, $${base + 1}, $${base + 2}, $${base + 3})`;
            })
            .join(", ");

          const params: any[] = [newPostId];
          srcAccs.forEach((r:any) => {
            params.push(r.bank_id, r.bank_name, r.seller_account || "");
          });

          await client.query(
            `INSERT INTO post_seller_accounts
              (post_id, bank_id, bank_name, seller_account)
            VALUES ${values}`,
            params
          );
        }

        // ==================================
        // 5) clone images
        // ==================================
        const { rows: srcImgs } = await client.query(
          `SELECT file_id
          FROM post_images
          WHERE post_id=$1
          ORDER BY id`,
          [id]
        );
        if (srcImgs.length) {
          const values = srcImgs.map((_:any, i:any) => `($1, $${i + 2})`).join(", ");
          await client.query(
            `INSERT INTO post_images (post_id, file_id)
            VALUES ${values}`,
            [newPostId, ...srcImgs.map((r:any) => r.file_id)]
          );
        }

        // ==================================
        // 6) LOG
        // ==================================
        await addLog(
          "info",
          "post-clone",
          "User cloned a post",
          { author_id, source_post_id: id, cloned_post_id: newPostId }
        );

        // ❗ สำคัญ: RETURN เป็น string ตรง ๆ ไม่ห่อ object ใด ๆ
        return newPostId;
      });
    },
    // createChat: async (_:any, { name, isGroup, memberIds }:{name?:string, isGroup:boolean, memberIds:string[]}, ctx:any) => {
    //   const author_id = requireAuth(ctx);
    //   console.log("[Mutation] createChat :", ctx, author_id);

    //   // ✅ ใช้ transaction ครอบทุกขั้นตอน
    //   return await runInTransaction(author_id, async (client) => {
    //     // 1) สร้าง chat ใหม่
    //     const { rows } = await client.query(
    //       `INSERT INTO chats (name, is_group, created_by)
    //       VALUES ($1,$2,$3)
    //       RETURNING *`,
    //       [name || null, isGroup, author_id]
    //     );
    //     const chat = rows[0];

    //     // 2) เพิ่มสมาชิกทั้งหมด (รวม creator)
    //     const allMembers = Array.from(new Set([author_id, ...memberIds]));
    //     for (const uid of allMembers) {
    //       await client.query(
    //         `INSERT INTO chat_members (chat_id, user_id)
    //         VALUES ($1,$2)
    //         ON CONFLICT DO NOTHING`,
    //         [chat.id, uid]
    //       );
    //     }

    //     // 3) ดึงข้อมูลสมาชิกและผู้สร้าง
    //     const mem = await client.query(
    //       `SELECT u.* 
    //         FROM chat_members m
    //         JOIN users u ON m.user_id = u.id
    //         WHERE m.chat_id = $1`,
    //       [chat.id]
    //     );
    //     const creator = await client.query(`SELECT * FROM users WHERE id=$1`, [chat.created_by]);

    //     // ✅ 4) บันทึก log (อยู่นอก query หลักแต่ยังใน transaction)
    //     await addLog('info', 'chat-create', 'Chat created', {
    //       chatId: chat.id,
    //       userId: author_id,
    //       members: allMembers.length,
    //     });

    //     // ✅ 5) คืนค่าผลลัพธ์
    //     return {
    //       ...chat,
    //       created_by: creator.rows[0],
    //       members: mem.rows,
    //     };
    //   });
    // },

    createChat: async (
      _: any,
      { name, isGroup, memberIds }: { name?: string; isGroup: boolean; memberIds: string[] },
      ctx: any
    ) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] createChat :", author_id);

      // ✅ 1) รันทุกอย่างใน transaction (สร้าง chat + members + log)
      const result = await runInTransaction(author_id, async (client) => {
        // 1) สร้าง chat ใหม่
        const { rows } = await client.query(
          `INSERT INTO chats (name, is_group, created_by)
          VALUES ($1,$2,$3)
          RETURNING *`,
          [name || null, isGroup, author_id]
        );
        const chat = rows[0];

        // 2) เพิ่มสมาชิกทั้งหมด (รวม creator)
        const allMembers = Array.from(new Set([author_id, ...memberIds]));
        for (const uid of allMembers) {
          await client.query(
            `INSERT INTO chat_members (chat_id, user_id)
            VALUES ($1,$2)
            ON CONFLICT DO NOTHING`,
            [chat.id, uid]
          );
        }

        // 3) ดึงข้อมูลสมาชิกและผู้สร้าง
        const mem = await client.query(
          `SELECT u.* 
            FROM chat_members m
            JOIN users u ON m.user_id = u.id
            WHERE m.chat_id = $1`,
          [chat.id]
        );
        const creator = await client.query(
          `SELECT * FROM users WHERE id = $1`,
          [chat.created_by]
        );

        // 4) บันทึก log
        await addLog('info', 'chat-create', 'Chat created', {
          chatId: chat.id,
          userId: author_id,
          members: allMembers.length,
        });

        // 5) คืนค่าผลลัพธ์ (ใช้เป็น response และใช้สร้าง noti ต่อ)
        return {
          ...chat,                 // id, name, is_group, created_by (เป็น uuid จาก table)
          created_by: creator.rows[0], // override ให้ field created_by เป็น object user (ตามที่คุณใช้ใน GraphQL)
          members: mem.rows,       // [{ id, name, ... }]
        };
      });

      // ✅ 2) สร้าง Notification ให้สมาชิกคนอื่น (อยู่นอก transaction → ไม่โดน rollback ถ้า noti พลาด)
      const chat = result; // แค่ rename ให้สั้น
      const creatorUser = chat.created_by; // user object
      const members = chat.members as any[];

      // member คนอื่นที่ไม่ใช่คนสร้าง
      const recipients = members.filter((m: any) => m.id !== author_id);

      await Promise.all(
        recipients.map((m: any) =>
          createNotification({
            user_id: m.id,
            type: 'CHAT_CREATED',
            title: chat.is_group
              ? `คุณถูกเพิ่มในกลุ่ม "${chat.name || ''}"`
              : `เริ่มแชทใหม่กับ ${creatorUser.name}`,
            message: chat.is_group
              ? `${creatorUser.name} สร้างห้องและเพิ่มคุณเข้ากลุ่ม`
              : `${creatorUser.name} เริ่มคุยกับคุณ`,
            entity_type: 'chat',
            entity_id: chat.id,
            data: {
              chat_id: chat.id,
              chat_name: chat.name,
              is_group: chat.is_group,
              actor_id: creatorUser.id,
              actor_name: creatorUser.name,
            },
          })
        )
      );

      // ✅ 3) คืนค่า chat ตามเดิม (เดิมคุณ return object นี้อยู่แล้ว)
      return chat;
    },
    addMember: async (_:any, { chat_id, user_id }:{chat_id:string, user_id:string}, ctx:any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] addMember :", ctx, author_id);

      return await runInTransaction(author_id, async (client) => {
        await client.query(
          `INSERT INTO chat_members (chat_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [chat_id, user_id]
        );

        await addLog('info', 'add-member', 'Add members', { chat_id,  user_id});

        return true;
      });
    },
    sendMessage: async (
      _: any,
      {
        chat_id,
        text,
        to_user_ids,
        images,
        reply_to_id
      }: {
        chat_id: string;
        text: string;
        to_user_ids: string[];
        images?: Promise<any>[]; // Upload scalar list
        reply_to_id?: string | null;
      },
      ctx: any
    ) => {
      const author_id = requireAuth(ctx);

      console.info("[sendMessage] =", author_id, chat_id, to_user_ids);

      // กรอง to_user_ids ให้ไม่ซ้ำ + ไม่รวมตัวเอง
      const cleanTo = Array.from(
        new Set(
          (to_user_ids || [])
            .filter(Boolean)
            .filter((id) => id !== author_id)
        )
      );

      // ===== Step 1: Pre-upload images (no transaction) =====
      let uploadedFiles: {
        id: number;
        relpath: string;
        mimetype: string | null;
        filename: string;
      }[] = [];

      if (images && images.length > 0) {
        uploadedFiles = await Promise.all(
          images.map(async (imgPromise) => {
            const upload = await imgPromise; // Upload object (Upload scalar)

            const renameTo = `chat_${chat_id}_${Date.now()}_${upload.fileName}`;
            const fileRow = await persistUploadStream(upload, renameTo);

            return {
              id: fileRow.id,
              relpath: fileRow.relpath,
              mimetype: fileRow.mimetype,
              filename: fileRow.filename,
            };
          })
        );
      }

      // ===== Step 2: Use transaction for DB operations =====
      const fullMessage = await runInTransaction(author_id, async (client) => {
        // 1) Insert message (เพิ่ม reply_to_id เข้าไป)
        const msgRes = await client.query(
          `
          INSERT INTO messages (chat_id, sender_id, text, reply_to_id)
          VALUES ($1,$2,$3,$4)
          RETURNING *
          `,
          [chat_id, author_id, text, reply_to_id || null]
        );
        const msg = msgRes.rows[0];

        // 2) Insert message_images
        if (uploadedFiles.length > 0) {
          for (const f of uploadedFiles) {
            await client.query(
              `
              INSERT INTO message_images (message_id, file_id, url, mime)
              VALUES ($1,$2,$3,$4)
              `,
              [
                msg.id,
                f.id,
                `/${f.relpath}`,
                f.mimetype,
              ]
            );
          }
        }

        // 3) Insert receipts for recipients
        if (cleanTo.length > 0) {
          await client.query(
            `
            INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
            SELECT $1, uid, NOW(), NULL
            FROM UNNEST($2::uuid[]) AS u(uid)
            ON CONFLICT (message_id, user_id) DO NOTHING
            `,
            [msg.id, cleanTo]
          );
        }

        // 4) sender receipt
        await client.query(
          `
          INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
          VALUES ($1,$2,NOW(),NOW())
          ON CONFLICT (message_id, user_id) DO NOTHING
          `,
          [msg.id, author_id]
        );

        // 5) Hydrate images (ให้เป็น [] แน่นอน ไม่ใช่ null)
        const imgRows = (
          await client.query(
            `
            SELECT id, file_id, url, mime, width, height
            FROM message_images
            WHERE message_id=$1
            `,
            [msg.id]
          )
        ).rows;

        const imagesSafe = Array.isArray(imgRows)
          ? imgRows.map((img: any) => ({
              id: img.id,
              url: img.url,
              file_id: img.file_id ?? null,
              mime: img.mime ?? null,
              width: img.width ?? null,
              height: img.height ?? null,
            }))
          : [];

        // 6) Hydrate sender + readers + receipt data
        const senderQ = await client.query(`SELECT * FROM users WHERE id=$1`, [
          author_id,
        ]);

        const readersQ = await client.query(
          `
          SELECT u.*
          FROM message_receipts r
          JOIN users u ON u.id=r.user_id
          WHERE r.message_id=$1 AND r.read_at IS NOT NULL
          `,
          [msg.id]
        );

        const cntQ = await client.query(
          `
          SELECT COUNT(*)::int AS c
          FROM message_receipts
          WHERE message_id=$1 AND read_at IS NOT NULL
          `,
          [msg.id]
        );

        const myRecQ = await client.query(
          `
          SELECT delivered_at, read_at, (read_at IS NOT NULL) AS is_read
          FROM message_receipts
          WHERE message_id=$1 AND user_id=$2
          `,
          [msg.id, author_id]
        );
        const mr = myRecQ.rows[0] || {};

        const createdISO = new Date(msg.created_at).toISOString();

        const myReceipt = {
          deliveredAt: mr?.delivered_at
            ? new Date(mr.delivered_at).toISOString()
            : createdISO,
          readAt: mr?.read_at ? new Date(mr.read_at).toISOString() : null,
          isRead: !!mr?.is_read,
        };

        return {
          id: msg.id,
          chat_id: msg.chat_id,
          sender: senderQ.rows[0],
          text: msg.text || "",
          created_at: createdISO,
          to_user_ids: cleanTo,

          images: imagesSafe,            // ✅ ไม่เป็น null แน่นอน

          myReceipt,
          readers: readersQ.rows,
          readersCount: Number(cntQ.rows[0]?.c || 0),
          is_deleted: false,
          deleted_at: null,

          reply_to_id: msg.reply_to_id,  // ✅ payload มี reply_to_id
        };
      });

      // ===== Step 3: publish realtime =====
      await pubsub.publish(topicChat(fullMessage.chat_id), {
        messageAdded: fullMessage, // ✅ รูปแบบเดียวกับที่ return ให้ client
      });

      const targetUserIds = [...cleanTo, author_id]; // คนรับทุกคน + คนส่งเอง (จะใช้เช็คว่า tab ไหนเปิดอยู่)
      await pubsub.publish(INCOMING_MESSAGE, {
        incomingMessage: fullMessage,
        targetUserIds,
      });

      console.info("[sendMessage][fullMessage] :", fullMessage);

      return fullMessage;
    },
    upsertUser: async (_: any, { id, data }: { id?: string, data: any }, ctx:any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] upsertUser :", ctx, author_id);

      // 2️⃣ ทำความสะอาดข้อมูล
      const name = (data.name ?? '').trim();
      const avatar = data.avatar ?? null;
      const phone = data.phone ?? null;
      const email = data.email ? String(data.email).trim().toLowerCase() : null;
      const role = (data.role ?? 'Subscriber').trim();
      const passwordHash = data.passwordHash ?? null;

      // ✅ ใช้ transaction wrapper เพื่อ ensure COMMIT/ROLLBACK และ SET LOCAL app.editor_id
      return await runInTransaction(author_id, async (client) => {
        let resultUser = null;

        if (id) {
          // 🧩 UPDATE: อัปเดต password_hash เฉพาะเมื่อส่งมา
          const { rows } = await client.query(
            `
            UPDATE users
               SET name = $1,
                   avatar = $2,
                   phone = $3,
                   role = $4,
                   password_hash = COALESCE($5::text, password_hash)
             WHERE id = $6
             RETURNING *;
            `,
            [name, avatar, phone, role, passwordHash, id]
          );

          resultUser = rows[0] || null;

          if (resultUser) {
            await addLog(
              "info",
              "user-update",
              "User profile updated",
              { userId: resultUser.id, editorId: author_id }
            );
          }
        } else {
          // 🧩 INSERT: ต้องมี email
          if (!email) throw new GraphQLError("email is required");

          const { rows } = await client.query(
            `
            INSERT INTO users (name, avatar, phone, email, role, password_hash)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
            `,
            [name, avatar, phone, email, role, passwordHash]
          );

          resultUser = rows[0] || null;

          if (resultUser) {
            // 📘 ตัวอย่าง: log ว่า user ถูกสร้างใหม่ (หรือ login สำเร็จ)
            await addLog(
              "info",
              "upsert-user", 
              "Upsert User",
              { userId: resultUser.id }
            );
          }
        }

        return resultUser;
      });
    },
    uploadAvatar: async (_: any, { user_id, file }: { user_id: string, file: Promise<GraphQLUploadFile> }, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] uploadAvatar :", author_id);

      const result = await runInTransaction(author_id, async (client) => {
        const f = await file; // { filename, mimetype, encoding, createReadStream }

        // สร้างชื่อใหม่ เช่น avatar-<user_id>.ext
        const ext = path.extname(f.filename || "");
        const renameTo = `avatar-${user_id}${ext || ""}`;

        const row = await persistUploadStream(f, renameTo); // 👈 ใช้ stream

        const avatarUrl = buildFileUrlById(row.id);

        await client.query(`UPDATE users SET avatar=$1 WHERE id=$2`, [
          avatarUrl,
          user_id,
        ]);

        await addLog("info", "upload-avatar", "Upload avatar", {
          userId: user_id,
          fileId: row.id,
        });

        return avatarUrl;
      });

      return result;
    },
    deleteUser: async (_: any, { id }: { id: string }, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] deleteUser:", id, author_id);

      const success = await runInTransaction(author_id, async (client) => {
        const res = await client.query(`DELETE FROM users WHERE id=$1`, [id]);
        const ok = res.rowCount === 1;

        if (ok) {
          await addLog('info', 'user-delete', 'User deleted', {
            deletedId: id,
            author_id,
          });
        }

        return ok;
      });

      return success;
    },
    deleteUsers: async (_: any, { ids }: { ids: string[] }, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] deleteUsers :", ctx, author_id);

      if (!ids || ids.length === 0) return false;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const uuidIds = ids.filter((i) => uuidPattern.test(i));
      if (uuidIds.length === 0) return false;
      return await runInTransaction(author_id, async (client) => {
        const res = await client.query(
          `DELETE FROM users WHERE id = ANY($1::uuid[])`,
          [uuidIds]
        );
        if (res.rowCount > 0) {
          await addLog(
            "info",
            "user-delete",
            `Deleted ${res.rowCount} user(s)`,
            { userId: author_id, deletedIds: uuidIds }
          );
        }

        return res.rowCount > 0;
      });
    },
    updateMyProfile: async (_:any, { data }:{ data: { name?: string, avatar?: string, phone?: string }}, ctx:any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] updateMyProfile :", author_id, data);

      const result = await runInTransaction(author_id, async (client) => {
        const { rows } = await client.query(
          `UPDATE users SET 
              name   = COALESCE($1, name),
              avatar = COALESCE($2, avatar),
              phone  = COALESCE($3, phone),
              updated_at = NOW()
          WHERE id = $4
          RETURNING *`,
          [data.name ?? null, data.avatar ?? null, data.phone ?? null, author_id]
        );

        return rows[0];
      });

      // ✅ log event หลัง transaction สำเร็จ
      await addLog(
        'info',
        'user-update-profile',
        'User updated profile',
        { userId: author_id, changed: Object.keys(data) }
      );

      return result;
    },
    renameChat: async (_:any, { chat_id, name }:{chat_id:string, name?:string}, ctx:any) => {
      const author_id = requireAuth(ctx); // ✅ ตรวจสิทธิ์
      console.log('[Mutation] renameChat :', chat_id, name, author_id);

      const result = await runInTransaction(author_id, async (client) => {
        await client.query(
          `UPDATE chats SET name=$1 WHERE id=$2`,
          [name || null, chat_id]
        );

        await addLog('info', 'chat-rename', 'Chat renamed', {
          chatId: chat_id,
          userId: author_id,
          newName: name || null,
        });

        return true;
      });

      return result;
    },
    deleteChat: async (_:any, { chat_id }:{chat_id:string}, ctx:any) => {
      const author_id = requireAuth(ctx);
      const result = await runInTransaction(author_id, async (client) => {
        await client.query(`DELETE FROM chats WHERE id = $1`, [chat_id]);

        await addLog(
          "info",
          "chat-delete",
          `User ${author_id} deleted chat ${chat_id}`,
          { author_id, chatId: chat_id }
        );

        return true;
      });

      return result;
    },
    markMessageRead: async (_:any, { message_id }:{ message_id:string }, ctx:any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] markMessageRead :", message_id, "by", author_id);

      const result = await runInTransaction(author_id, async (client) => {
        await client.query(
          `UPDATE message_receipts
            SET read_at = COALESCE(read_at, NOW())
          WHERE message_id = $1 AND user_id = $2`,
          [message_id, author_id]
        );

        await addLog(
          "info",                  // ระดับ log
          "message-read",          // หมวดหมู่
          "User marked message as read", // ข้อความหลัก
          { userId: author_id, messageId: message_id } // meta เพิ่มเติม
        );

        return true;
      });

      return result;
    },
    markChatReadUpTo: async (_:any, { chat_id, cursor }:{ chat_id:string, cursor:string }, ctx:any) => {
      // 1️⃣ ตรวจสอบสิทธิ์ผู้ใช้
      const author_id = requireAuth(ctx);
      console.log('[Mutation] markChatReadUpTo :', author_id, chat_id, cursor);

      // 2️⃣ ทำงานใน transaction
      const result = await runInTransaction(author_id, async (client) => {
        await client.query(
          `
          UPDATE message_receipts r
            SET read_at = COALESCE(r.read_at, NOW())
            FROM messages m
          WHERE r.message_id = m.id
            AND r.user_id = $1
            AND m.chat_id = $2
            AND m.created_at <= ($3::timestamptz + interval '1 millisecond')
          `,
          [author_id, chat_id, cursor]
        );

        // 3️⃣ log ลงระบบ
        await addLog(
          'info',
          'chat-read',
          'User marked chat messages as read',
          { userId: author_id, chatId: chat_id, cursor }
        );

        return true;
      });

      return result;
    },
    deleteMessage: async (_:any, { message_id }:{ message_id:string }, ctx:any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] deleteMessage :", ctx, author_id);

      return await runInTransaction(author_id, async (client) => {
        const { rows } = await client.query(
          `SELECT id, chat_id, sender_id, deleted_at FROM messages WHERE id=$1 LIMIT 1`,
          [message_id]
        );
        const msg = rows[0];
        if (!msg) return false;

        // 2️⃣ ตรวจสิทธิ์ (optional)
        // const canDelete = (msg.sender_id === author_id) || ctx?.admin?.role === 'Administrator';
        // if (!canDelete) throw new GraphQLError('FORBIDDEN', { extensions: { code: 'FORBIDDEN' } });

        // 3️⃣ ลบ (soft delete)
        const { rowCount } = await client.query(
          `UPDATE messages SET deleted_at = NOW() WHERE id=$1 AND deleted_at IS NULL`,
          [message_id]
        );

        if (!rowCount) {
          console.warn(`[deleteMessage] message already deleted: ${message_id}`);
          return false;
        }

        // 4️⃣ Publish event สำหรับ subscribers
        await pubsub.publish(topicChat(msg.chat_id), { messageDeleted: message_id });

        // 5️⃣ บันทึก log
        await addLog(
          'info',
          'message-delete',
          'User deleted message',
          { userId: author_id, messageId: message_id, chatId: msg.chat_id }
        );

        return true;
      });
    },
    deleteFile: async (_: any, { id }: { id: string }, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] deleteFile :", { id, author_id });

      const result = await runInTransaction(author_id, async (client) => {
        const res = await client.query(`DELETE FROM files WHERE id = $1`, [id]);

        if (res.rowCount === 1) {
          await addLog(
            "info",
            "file-delete",
            "User deleted a file",
            { author_id, fileId: id }
          );
          return true;
        } else {
          return false;
        }
      });

      return result;
    },
    deleteFiles: async (_: any, { ids }: { ids: string[] }, ctx: any) => {
      const author_id = requireAuth(ctx);
      console.log("[Mutation] deleteFiles :", ids, "by", author_id);

      if (!ids?.length) return false;

      const intIds = ids.map(n => parseInt(String(n), 10)).filter(n => !isNaN(n));
      if (!intIds.length) return false;

      return await runInTransaction(author_id, async (client) => {
        const res = await client.query(
          `DELETE FROM files WHERE id = ANY($1::int[])`,
          [intIds]
        );

        const deleted = res.rowCount > 0;

        if (deleted) {
          await addLog(
            'info',
            'file-delete',
            'User deleted files',
            { author_id, ids: intIds }
          );
        }

        return deleted;
      });
    },
    renameFile: async (_: any, { id, name }: { id: string, name: string }, ctx: any) => {
      const author_id = requireAuth(ctx); // ✅ ตรวจสิทธิ์ก่อน
      console.log("[Mutation] renameFile by:", author_id);

      // ✅ ใช้ transaction helper
      const success = await runInTransaction(author_id, async (client) => {
        const res = await client.query(
          `UPDATE files 
             SET original_name = $1, updated_at = NOW()
           WHERE id = $2`,
          [name, id]
        );

        return res.rowCount === 1;
      });

      // ✅ บันทึก log หลัง commit
      if (success) {
        await addLog(
          'info',
          'file-rename',
          'User renamed a file',
          { author_id, fileId: id, newName: name }
        );
      }

      return success;
    },
    toggleBookmark: async (_: any, { postId }: { postId: string }, ctx: any) => {
      const userId = requireAuth(ctx);
      const start = Date.now();

      console.log("[toggleBookmark]", userId, postId);

      // ✅ ทำงานใน transaction
      const result = await runInTransaction(userId, async (client) => {
        // ตรวจว่ามี bookmark อยู่แล้วไหม
        const { rowCount: exists } = await client.query(
          `SELECT 1 FROM bookmarks WHERE post_id = $1 AND user_id = $2`,
          [postId, userId]
        );

        let isBookmarked: boolean;

        if (exists) {
          // ถ้ามี → ลบออก
          await client.query(
            `DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2`,
            [postId, userId]
          );
          isBookmarked = false;
        } else {
          // ถ้ายังไม่มี → เพิ่มใหม่
          await client.query(
            `INSERT INTO bookmarks (post_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (post_id, user_id) DO NOTHING`,
            [postId, userId]
          );
          isBookmarked = true;
        }

        return { isBookmarked };
      });

      // ✅ หลัง transaction commit → addLog สำหรับ external service (optional)
      await addLog(
        'info',
        'bookmark',
        'User toggled bookmark',
        { userId, postId, isBookmarked: result.isBookmarked }
      );

      return {
        status: true,
        isBookmarked: result.isBookmarked,
        executionTime: `${((Date.now() - start) / 1000).toFixed(3)}s`,
      };
    },
    markNotificationRead: async ( _: any, args: { id: string }, ctx: any ) => {
      const user = ctx.user;
      if (!user) throw new Error('Unauthorized');
      const { rows } = await query(
        `
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = $1
          AND user_id = $2
        RETURNING id
        `,
        [args.id, user.id]
      );

      return rows.length > 0;
    },
    markAllNotificationsRead: async (_: any, __: any, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('Unauthorized');

      await query(
        `
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = $1
          AND is_read = FALSE
        `,
        [user.id]
      );

      return true;
    },
    addComment: async (_: any, { post_id, content }: any, ctx: any) => {
      const author_id = requireAuth(ctx); 
      
      const user = await getUserById(author_id); // { id, name, avatar, ... }

      console.log("[Mutation] addComment:", author_id, user);

      const id = uuidv4();

      // insert comment
      const { rows } = await query(
        `
        INSERT INTO comments (id, post_id, user_id, content)
        VALUES ($1,$2,$3,$4)
        RETURNING *
        `,
        [id, post_id, user.id, content]
      );
      const comment = rows[0];

      console.log("[Mutation] addComment-comment", comment);

      // หาเจ้าของโพสต์เพื่อแจ้งเตือน
      const postRes = await query(
        `SELECT id, author_id FROM posts WHERE id = $1`,
        [post_id]
      );
      const post = postRes.rows[0];

      if (post && post.author_id !== user.id) {
        await createNotification({
          user_id: post.author_id,
          type: 'POST_COMMENT',
          title: 'มีคอมเมนต์ใหม่ในโพสต์ของคุณ',
          message: `${user.name}: ${content.substring(0, 80)}`,
          entity_type: 'post',
          entity_id: post_id,
          data: {
            post_id,
            comment_id: comment.id,
            actor_id: user.id,
            actor_name: user.name,
          },
        });
      }

      // 👇 สร้าง object เวอร์ชัน GraphQL ที่มี user + replies
      const gqlComment = {
        ...comment,        // id, post_id, user_id, parent_id, content, created_at, updated_at
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar ?? null,
          // ถ้ามี field อื่นใน type User ก็เติมได้
        },
        replies: [] as any[],
      };

      // broadcast subscription → ส่ง object แบบเดียวกับที่ mutation คืน
      await pubsub.publish(COMMENT_ADDED, {
        commentAdded: gqlComment,
      });

      // คืนค่า object ที่พร้อม field user + replies
      return gqlComment;
    },
    replyComment: async (_: any, { comment_id, content }: any, ctx: any) => {
      const author_id = requireAuth(ctx);
      const user = await getUserById(author_id);

      console.log("[replyComment]", author_id, user);

      const id = uuidv4();

      const { rows: baseRows } = await query(
        `SELECT * FROM comments WHERE id = $1`,
        [comment_id]
      );
      const parent = baseRows[0];
      if (!parent) throw new Error('Comment not found');

      const { rows } = await query(
        `
        INSERT INTO comments (id, post_id, user_id, parent_id, content)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *
        `,
        [id, parent.post_id, user.id, comment_id, content]
      );
      const reply = rows[0];

      // noti เหมือนเดิม
      if (parent.user_id !== user.id) {
        await createNotification({
          user_id: parent.user_id,
          type: 'POST_COMMENT_REPLY',
          title: 'มีคนตอบคอมเมนต์ของคุณ',
          message: `${user.name}: ${content.substring(0, 80)}`,
          entity_type: 'comment',
          entity_id: comment_id,
          data: {
            post_id: parent.post_id,
            comment_id,
            reply_id: reply.id,
            actor_id: user.id,
            actor_name: user.name,
          },
        });
      }

      const gqlReply = {
        ...reply,
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar ?? null,
        },
        replies: [] as any[], // reply ใหม่ยังไม่มีลูกตัวเอง
      };

      await pubsub.publish(COMMENT_ADDED, {
        commentAdded: gqlReply,
      });

      return gqlReply;
    },

    updateComment: async (_: any, { id, content }: any, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('Unauthorized');

      // ตรวจว่าเป็นเจ้าของคอมเมนต์
      const { rows: ownRows } = await query(
        `SELECT * FROM comments WHERE id = $1`,
        [id]
      );
      const c = ownRows[0];
      if (!c) throw new Error('Comment not found');
      if (c.user_id !== user.id) throw new Error('Forbidden');

      const { rows } = await query(
        `
        UPDATE comments
        SET content = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [id, content]
      );

      const updated = rows[0];

      await pubsub.publish(COMMENT_UPDATED, {
        commentUpdated: updated,
      });

      return updated;
    },

    deleteComment: async (_: any, { id }: any, ctx: any) => {
      const user = ctx.user;
      if (!user) throw new Error('Unauthorized');

      const { rows: ownRows } = await query(
        `SELECT * FROM comments WHERE id = $1`,
        [id]
      );
      const c = ownRows[0];
      if (!c) return false;
      if (c.user_id !== user.id) throw new Error('Forbidden');

      await query(`DELETE FROM comments WHERE id = $1`, [id]);

      await pubsub.publish(COMMENT_DELETED, {
        commentDeleted: id,
      });

      return true;
    },
  },
};
