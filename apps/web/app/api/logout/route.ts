import { NextResponse } from "next/server";
const ADMIN_COOKIE = "ADMIN_SESSION";

export async function POST(){
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly:true, path:"/", maxAge:0 });
  return res;
}
