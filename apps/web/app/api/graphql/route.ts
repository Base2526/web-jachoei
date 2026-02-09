export const runtime = "nodejs";

import { registerPostEventListeners } from "@events/register.server";
await registerPostEventListeners();


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

function getClientIp(req: NextRequest) {
  // ใส่ CDN/Proxy ได้หลายชั้น
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") || // cloudflare
    req.headers.get("true-client-ip") ||   // some proxies
    "unknown"
  );
}

function isAndroidRequest(req: NextRequest) {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  // RN/OkHttp/Android WebView มักมีคำว่า android หรือ okhttp
  return ua.includes("android") || ua.includes("okhttp");
}

function logIncoming(req: NextRequest, extra?: Record<string, any>) {
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent") || "";
  const scope = req.headers.get("x-scope") || "";
  const ct = req.headers.get("content-type") || "";
  const ref = req.headers.get("referer") || "";
  const android = isAndroidRequest(req);

  console.log(
    `[GraphQL IN] ${new Date().toISOString()} ${req.method} ${req.nextUrl.pathname}` +
      ` ip=${ip}` +
      ` android=${android}` +
      ` scope=${scope || "-"}` +
      ` ct=${ct || "-"}` +
      ` ref=${ref ? ref.slice(0, 120) : "-"}`
  );
  
  if (android) {
    console.log("[Android UA]", ua);
  }

  if (extra) console.log("[GraphQL IN extra]", extra);
}

const handler = startServerAndCreateNextHandler<NextRequest>(server, {
  context: createContext,
});

// ตัวกลาง: เช็คว่าเป็น multipart/form-data ไหม
const requestHandler = async (request: NextRequest) => {
  const contentType = request.headers.get("content-type") || "";

  logIncoming(request, { multipart: contentType.includes("multipart/form-data") });

  if (contentType.includes("multipart/form-data")) {
    // ใช้ uploadProcess จาก graphql-upload-nextjs
    const context = await createContext(request);
    return uploadProcess(request, context, server as any);
  }

  // ปกติ: ให้ Apollo/Next handler จัดการ JSON request ตามเดิม
  return handler(request);
};

// export const runtime = "nodejs";

// export ออกเป็น method ต่างๆ
export { requestHandler as POST, requestHandler as GET, requestHandler as OPTIONS };
