import { ApolloServer } from "@apollo/server";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { mergedTypeDefs as typeDefs, mergedResolvers as resolvers } from "@/graphql";
import { query } from "@/lib/db"; // <- ฟังก์ชัน query pg ของคุณ

const schema = makeExecutableSchema({ typeDefs, resolvers });

const server = new ApolloServer({
  schema,
  introspection: process.env.NODE_ENV !== "production",
  csrfPrevention: false,
});

const handler = startServerAndCreateNextHandler(server, {
  context: async (req:any, res:any) => {
    // ดึง token จาก Authorization หรือ cookie
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.replace(/^Bearer\s+/i, "").trim();
    const cookieToken = (() => {
      const c = req.headers.get("cookie") || "";
      const m = c.match(/(?:^|;\s*)token=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : "";
    })();
    const token = bearer || cookieToken;

    let user = null;
    if (token) {
      const { rows } = await query(
        `SELECT u.id, u.name, u.email, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = $1 AND s.expired_at > NOW()
         LIMIT 1`,
        [token]
      );
      user = rows[0] || null;
    }

    console.log("[ApolloServer] handler :", auth, token, user /*, req, res */);

    return { req, res, user, token };
  },
});

export { handler as GET, handler as POST };

