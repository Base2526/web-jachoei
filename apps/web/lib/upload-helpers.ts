import path from 'path';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

type YogaFile = File; // ใน Yoga/Fetch API ได้เป็น File (Web)
type MaybePromise<T> = T | Promise<T>;

export async function saveUpload(filePromise: MaybePromise<YogaFile>) {
  const file = await filePromise;
  const ext = path.extname(file.name || '.png');
  const outName = randomUUID() + ext;
  const dir = "/app/storage"; //path.join(process.cwd(), 'public', 'uploads');

  console.log("[dir]", dir);
  const outPath = path.join(dir, outName);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // ✅ ใช้ Web API -> ArrayBuffer -> Buffer -> writeFile
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(outPath, buf);

  return `/uploads/${outName}`;
}

export async function saveUploads(files?: Array<MaybePromise<YogaFile>>) {
  if (!files?.length) return [];
  const urls: string[] = [];
  for (const f of files) {
    if (!f) continue;
    urls.push(await saveUpload(f));
  }
  return urls;
}
