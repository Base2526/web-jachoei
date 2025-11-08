// import * as jwt from "jsonwebtoken";
// import { cookies } from "next/headers";

// // ชื่อ cookie แยกกันระหว่าง user และ admin
// export const USER_COOKIE = "USER_COOKIE";
// export const ADMIN_COOKIE = "ADMIN_COOKIE";
// export const JWT_SECRET = process.env.JWT_SECRET || "changeme_secret";

// // payload ที่เซ็นใน JWT
// export interface JWTPayload {
//   id: number;
//   email: string;
//   role: string;        // เช่น "Subscriber" | "Author" | "Administrator"
//   exp?: number;
//   iat?: number;
// }

// /**
//  * ✅ ตรวจ token ของ User ทั่วไป
//  * - อ่าน cookie user_token
//  * - verify JWT ด้วย secret เดียวกัน
//  * - คืนค่า payload หรือ null ถ้าไม่ผ่าน
//  */
// export function verifyUserSession(): JWTPayload | null {
//   try {
//     const cookieStore = cookies();
//     const token = cookieStore.get(USER_COOKIE)?.value;
//     if (!token) return null;

//     const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

//     console.log("[verifyUserSession]", payload);

//     // ถ้า role เป็น Administrator ก็ถือว่าใช้ user ได้เช่นกัน
//     if (!payload.role) return null;
//     return payload;
//   } catch (err) {
//     console.error("[verifyUserSession] invalid:", err);
//     return null;
//   }
// }

// /**
//  * ✅ ตรวจ token ของ Admin โดยเฉพาะ
//  * - อ่าน cookie admin_token
//  * - ต้องมี role === 'Administrator'. const ADMIN_COOKIE = "ADMIN_SESSION";
//  */
// export function verifyAdminSession(): JWTPayload | null {
//   try {
//     const cookieStore = cookies();
//     const token = cookieStore.get(ADMIN_COOKIE)?.value;
//     if (!token) return null;

//     const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

//     console.log("[verifyAdminSession]", payload);

//     if (payload.role !== "Administrator") return null;
//     return payload;
//   } catch (err) {
//     console.error("[verifyAdminSession] invalid:", err);
//     return null;
//   }
// }
import { GraphQLError } from "graphql/error";
import { createHash } from "crypto";

export function requireAuth(ctx: any): string {
  const scope = ctx?.scope;

  // ✅ ตรวจว่า scope มีหรือไม่
  if (!scope || !['web', 'admin'].includes(scope)) {
    throw new GraphQLError("Unauthorized scope", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }

  // ✅ แยกตรวจตาม scope
  if (scope === 'admin') {
    const uid = ctx?.admin?.id;
    if (!uid) {
      throw new GraphQLError("Admin not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    return uid;
  }

  if (scope === 'web') {
    const uid = ctx?.user?.id;
    if (!uid) {
      throw new GraphQLError("User not authenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    return uid;
  }

  // ✅ fallback safety
  throw new GraphQLError("Invalid authentication context", {
    extensions: { code: "UNAUTHENTICATED" },
  });
}

export function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}
