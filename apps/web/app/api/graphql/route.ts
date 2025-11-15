// import { ApolloServer } from "@apollo/server";
// import { makeExecutableSchema } from "@graphql-tools/schema";
// import { startServerAndCreateNextHandler } from "@as-integrations/next";
// import { mergedTypeDefs as typeDefs, mergedResolvers as resolvers } from "@/graphql";
// import { query } from "@/lib/db"; // <- ฟังก์ชัน query pg ของคุณ

// import { verifyAdminSession, verifyUserSession } from "@/lib/auth/server";

// const schema = makeExecutableSchema({ typeDefs, resolvers });

// const server = new ApolloServer({
//   schema,
//   introspection: process.env.NODE_ENV !== "production",
//   csrfPrevention: false,
// });

// const handler = startServerAndCreateNextHandler(server, {
//   context: async (req:any, res:any) => {
//     // 1) อ่าน x-scope ถ้ามี
//     let scope = req.headers.get("x-scope") || "";

//     // 2) Fallback: ใช้ referer ชี้ว่า admin/web
//     if (!scope) {
//       const ref = req.headers.get("referer") || "";
//       if (ref.includes("/admin") /*|| ref.includes("//admin.")*/ ) scope = "admin";
//     }

//     // 3) default เป็น web
//     if (!scope) scope = "web";

//     const admin = verifyAdminSession(); // อ่าน cookie ฝั่ง server
//     const user  = verifyUserSession();

//     // console.log("[graphql-handler] x-scope:", scope ); // ควรเห็นค่าแล้ว
//     return { scope, admin, user };
//   },
//   /*
//   context: async (req:any, res:any) => {
//     // ดึง token จาก Authorization หรือ cookie
//     const auth = req.headers.get("authorization") || "";
//     const bearer = auth.replace(/^Bearer\s+/i, "").trim();
//     const cookieToken = (() => {
//       const c = req.headers.get("cookie") || "";
//       const m = c.match(/(?:^|;\s*)token=([^;]+)/);
//       return m ? decodeURIComponent(m[1]) : "";
//     })();
//     const token = bearer || cookieToken;

//     let user = null;
//     if (token) {
//       const { rows } = await query(
//         `SELECT u.id, u.name, u.email, u.role
//          FROM sessions s
//          JOIN users u ON u.id = s.user_id
//          WHERE s.token = $1 AND s.expired_at > NOW()
//          LIMIT 1`,
//         [token]
//       );
//       user = rows[0] || null;
//     }


//     return { req, res, user, token };
//   },
//   */
// });

// export { handler as GET, handler as POST };


// apps/web/app/api/graphql/route.ts
import { createYoga } from 'graphql-yoga';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { mergedTypeDefs as typeDefs, mergedResolvers as resolvers } from '@/graphql';
// ถ้ามี context ของคุณอยู่แล้ว นำมาใช้ต่อได้:
import { verifyAdminSession, verifyUserSession } from '@/lib/auth/server';

const schema = makeExecutableSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  
  // สร้าง context เดิมของคุณได้เหมือนเดิม
  context: async ({ request }) => {
    let scope = request.headers.get('x-scope') || '';
    if (!scope) {
      const ref = request.headers.get('referer') || '';
      if (ref.includes('/admin')) scope = 'admin';
    }
    if (!scope) scope = 'web';
    const admin = verifyAdminSession();
    const user  = verifyUserSession();
    return { scope, admin, user };
  },
  maskedErrors: false, // <-- DEV แนะนำปิดไว้เพื่อให้ client ได้ extensions จริง
  // Yoga รองรับ multipart upload ใน App Router โดยไม่ต้องตั้งค่าเพิ่ม

 
});

export { yoga as GET, yoga as POST };