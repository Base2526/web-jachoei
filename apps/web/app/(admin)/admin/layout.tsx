// apps/web/app/(admin)/admin/layout.tsx
// import { cookies } from "next/headers";
// import * as jwt from "jsonwebtoken";
import AdminLayoutClient from "@/components/AdminLayoutClient";

// --- ค่าคงที่ ---
// const ADMIN_COOKIE = "ADMIN_SESSION";
// const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// type JWTPayload = {
//   sub: string;
//   role: string;
//   name?: string;
//   email?: string;
//   iat?: number;
//   exp?: number;
// };

// --- ฟังก์ชันตรวจ JWT ---
// function verifyAdminSession(): JWTPayload | null {
//   try {
//     const cookieStore = cookies();
//     const token = cookieStore.get(ADMIN_COOKIE)?.value;
//     if (!token) return null;
//     const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

//     console.log("[verifyAdminSession]", payload);
//     if (payload.role !== "Administrator") return null;
//     return payload;
//   } catch {
//     return null;
//   }
// }

// --- Layout ---
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // // ตรวจสิทธิ์ก่อน render
  // const session = verifyAdminSession();
  // // if (!session) {
  // //   redirect("/admin/login");
  // // }

  // const langCookie = cookies().get("lang")?.value ?? "th"; // 'th' | 'en'

  

  return (
    <>
      <main style={{ padding: 24 }}>
         <AdminLayoutClient>{children}</AdminLayoutClient>
      </main>
    </>
  );
}
