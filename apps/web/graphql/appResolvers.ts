import { query } from "@/lib/db";

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
        return rows.map(r=>({ ...r, author: r.author_json }));
      }
      const { rows } = await query(
        `SELECT p.*, row_to_json(u.*) as author_json
         FROM posts p LEFT JOIN users u ON p.author_id = u.id
         ORDER BY p.created_at DESC`
      );
      return rows.map(r=>({ ...r, author: r.author_json }));
    },
    post: async (_:any, { id }:{id:string}) => {
      const { rows } = await query(
        `SELECT p.*, row_to_json(u.*) as author_json
         FROM posts p LEFT JOIN users u ON p.author_id = u.id
         WHERE p.id = $1`, [id]
      );
      const r = rows[0]; if (!r) return null;
      return { ...r, author: r.author_json };
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
    }
  }
};
