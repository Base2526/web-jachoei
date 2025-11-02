// apps/web/app/api/auth/logout-admin/route.ts
import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/auth/token";

const isProd = process.env.NODE_ENV === "production";
export async function POST() {

  console.log("[ADMIN_COOKIE] POST");
  const res = NextResponse.json({ ok: true, message: "Admin logged out" });
  res.cookies.set(ADMIN_COOKIE, "", {
    path: "/", 
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    expires: new Date(0),
    maxAge: 0,
  });
  return res;
}
