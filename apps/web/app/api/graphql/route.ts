// import { ApolloServer } from "@apollo/server";
// import { makeExecutableSchema } from "@graphql-tools/schema";
// import { startServerAndCreateNextHandler } from "@as-integrations/next";
// import { mergedTypeDefs as typeDefs, mergedResolvers as resolvers } from "@/graphql";
// import { query } from "@/lib/db"; // <- ฟังก์ชัน query pg ของคุณ

// import { verifyAdminSession, verifyUserSession } from '@/lib/auth/server';

// const schema = makeExecutableSchema({ typeDefs, resolvers });

// const server = new ApolloServer({
//   schema,
//   introspection: process.env.NODE_ENV !== "production",
//   csrfPrevention: false,
// });

// const handler = startServerAndCreateNextHandler(server, {
//   context: async (request:any, res:any) => {
//     let scope = request.headers.get('x-scope') || '';
//     if (!scope) {
//       const ref = request.headers.get('referer') || '';
//       if (ref.includes('/admin')) scope = 'admin';
//     }
//     if (!scope) scope = 'web';
//     const admin = verifyAdminSession();
//     const user  = verifyUserSession();
//     return { scope, admin, user };
//   },
// });

// export { handler as GET, handler as POST };

// app/api/graphql/route.ts

import { ApolloServer } from "@apollo/server";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { NextRequest } from "next/server";

import {
  mergedTypeDefs as typeDefs,
  mergedResolvers as resolvers,
} from "@/graphql";

import { verifyAdminSession, verifyUserSession } from "@/lib/auth/server";

// 👇 จาก graphql-upload-nextjs
import {
  GraphQLUpload,
  uploadProcess,
  type File as UploadFile,
} from "graphql-upload-nextjs";

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const server = new ApolloServer({
  schema,
  introspection: process.env.NODE_ENV !== "production",
  csrfPrevention: false,
});

// แยกฟังก์ชันสร้าง context ไว้ใช้ซ้ำ (ทั้งปกติและ multipart)
async function createContext(request: NextRequest) {
  let scope = request.headers.get("x-scope") || "";
  if (!scope) {
    const ref = request.headers.get("referer") || "";
    if (ref.includes("/admin")) scope = "admin";
  }
  if (!scope) scope = "web";

  const admin = verifyAdminSession();
  const user = verifyUserSession();
  return { scope, admin, user, req: request };
}

const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: createContext,
});

// ตัวกลาง: เช็คว่าเป็น multipart/form-data ไหม
const requestHandler = async (request: NextRequest) => {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // ใช้ uploadProcess จาก graphql-upload-nextjs
    const context = await createContext(request);
    return uploadProcess(request, context, server as any);
  }

  // ปกติ: ให้ Apollo/Next handler จัดการ JSON request ตามเดิม
  return handler(request);
};

export const runtime = "nodejs";

// export ออกเป็น method ต่างๆ
export { requestHandler as POST, requestHandler as GET, requestHandler as OPTIONS };
