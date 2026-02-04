import "server-only";                 // ป้องกันโดน import ฝั่ง client
import { cookies } from "next/headers";
import { verifyTokenString, USER_COOKIE, ADMIN_COOKIE, JWTPayload } from "./token";

export function verifyUserSession(): JWTPayload | null {
  const token = cookies().get(USER_COOKIE)?.value;
  const payload = verifyTokenString(token);
  if (!payload?.role) return null;
  return payload;
}

export function verifyAdminSession(): JWTPayload | null {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  const payload = verifyTokenString(token);

  // console.log("[verifyAdminSession]", payload, token);
  // if (payload?.role !== "Administrator") return null;

  // if (!payload?.role) return null;
  return payload;
}
