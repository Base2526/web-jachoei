import fs from "fs";
import path from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || "/app/storage";

export function ensureStorage() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  return STORAGE_DIR;
}

export function makeSafeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim();
}

export function dateDir() {
  const d = new Date();
  const dir = path.join(STORAGE_DIR, `${d.getFullYear()}`, String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0"));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function fullPath(rel: string) {
  return path.join(STORAGE_DIR, rel);
}
