// apps/web/lib/passwordReset.ts
import crypto from "crypto";
import { query } from "@/lib/db";

const RESET_TOKEN_TTL_MIN = 15; // 15 นาที

export async function createResetToken(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000);
  await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at, used)
     VALUES ($1,$2,$3,false)`,
    [userId, token, expiresAt]
  );
  return { token, expiresAt };
}

// ตัวอย่าง placeholder สำหรับส่งอีเมล (เปลี่ยนเป็น provider ของคุณ)
export async function sendPasswordResetEmail(toEmail: string, resetUrl: string) {
  console.log("[SEND RESET EMAIL] to:", toEmail, " link:", resetUrl);
  // ใช้ SMTP/Sendgrid/SES ตามระบบคุณ
}
