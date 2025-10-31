// apps/web/middleware.ts
import { NextRequest, NextResponse } from "next/server";
const ADMIN_COOKIE = "ADMIN_SESSION";
const PUBLIC = ["/admin/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  const token = req.cookies.get(ADMIN_COOKIE)?.value;

  console.log("middleware :", token);
  if (!token) return redirectToLogin(req);
  return NextResponse.next(); // verification ทำใน layout/route handler
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", req.nextUrl.pathname + (req.nextUrl.search || ""));
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/admin/:path*"] };
