// utils/maskEmail.ts
export function maskEmail(
  email: string,
  {
    showPrefix = 5,        // โชว์กี่ตัวหน้า @
    maskChar = "*",        // ตัวที่ใช้ปิดบัง
    maskCount = 4,         // จำนวนตัว mask ที่แสดง
  }: { showPrefix?: number; maskChar?: string; maskCount?: number } = {}
): string {
  if (!email) return "";

  const at = email.indexOf("@");
  if (at <= 0) return email; // ไม่ใช่อีเมล

  const local = email.slice(0, at);
  const domain = email.slice(at); // รวม @

  const prefix = local.slice(0, Math.min(showPrefix, local.length));
  const masked = maskChar.repeat(maskCount);

  return `${prefix}${masked}${domain}`;
}

export function maskEmailKeepLength(email: string, showPrefix = 5, maskChar = "*") {
  const at = email.indexOf("@");
  if (at <= 0) return email;

  const local = email.slice(0, at);
  const domain = email.slice(at);

  const prefix = local.slice(0, Math.min(showPrefix, local.length));
  const hiddenLen = Math.max(local.length - prefix.length, 0);

  return `${prefix}${maskChar.repeat(hiddenLen)}${domain}`;
}
