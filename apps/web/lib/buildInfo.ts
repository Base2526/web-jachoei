import fs from "fs";
import path from "path";

/**
 * อ่าน BUILD_ID ของ Next.js จาก .next/BUILD_ID
 * - production: ได้ค่า build id จริง
 * - dev / ยังไม่ build: fallback = "dev"
 */
export function getBuildId(cwd: string = process.cwd()): string {
  try {
    const p = path.join(cwd, ".next", "BUILD_ID");
    return fs.readFileSync(p, "utf8").trim();
  } catch {
    return "dev";
  }
}

/**
 * เวลาที่ build (inject ตอน build time)
 * แนะนำ set ใน Dockerfile / CI
 */
export function getBuildTime(): string {
  return process.env.NEXT_PUBLIC_BUILD_TIME ?? "unknown";
}

/**
 * helper รวมข้อมูล build
 */
export function getBuildInfo() {
  return {
    buildId: getBuildId(),
    buildTime: getBuildTime(),
  };
}
