import { IncomingMessage } from "http";
import { parse } from "cookie";
import { verifyTokenString, USER_COOKIE, ADMIN_COOKIE, JWTPayload } from "./token";

export function verifyUserSessionFromReq(req: IncomingMessage): JWTPayload | null {
  const raw = req.headers.cookie || "";
  const jar = parse(raw);
  const payload = verifyTokenString(jar[USER_COOKIE]);
  if (!payload?.role) return null;
  return payload;
}

export function verifyAdminSessionFromReq(req: IncomingMessage): JWTPayload | null {
  const raw = req.headers.cookie || "";
  const jar = parse(raw);
  const payload = verifyTokenString(jar[ADMIN_COOKIE]);
  if (payload?.role !== "Administrator") return null;
  return payload;
}
