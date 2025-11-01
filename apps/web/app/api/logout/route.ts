import { NextResponse } from "next/server";
const ADMIN_COOKIE = "ADMIN_COOKIE";

export async function POST(){

  console.log("[logout]");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly:true, path:"/", maxAge:0 });
  return res;
}
