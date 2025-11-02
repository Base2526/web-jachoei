// apps/web/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/auth/token";

export async function POST() {
  const res = NextResponse.json({ ok: true, message: "User logged out" });

  res.cookies.set(USER_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0, // ลบ cookie ทันที
  });

  return res;
}
