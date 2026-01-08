// apps/web/scripts/social-worker.mjs
import { Redis } from "ioredis";
import pg from "pg";

import { Agent } from "undici";

// ✅ เอา X ออก: ไม่ต้องใช้ xPublisher แล้ว
// import { publishToX, resolveAbsoluteUrl, deleteTweetById } from "../lib/xPublisher.ts";

const { Pool } = pg;

// Redis
const redis = new Redis(process.env.REDIS_URL ?? "redis://redis:6379");
const QUEUE_KEY =
  process.env.SOCIAL_QUEUE_KEY && process.env.SOCIAL_QUEUE_KEY.trim() !== ""
    ? process.env.SOCIAL_QUEUE_KEY
    : "social:publish:queue";
const DLQ_KEY =
  process.env.SOCIAL_DLQ_KEY && process.env.SOCIAL_DLQ_KEY.trim() !== ""
    ? process.env.SOCIAL_DLQ_KEY
    : "social:publish:dlq";
const DELAYED_KEY =
  process.env.SOCIAL_DELAYED_KEY && process.env.SOCIAL_DELAYED_KEY.trim() !== ""
    ? process.env.SOCIAL_DELAYED_KEY
    : "social:publish:delayed";

// Postgres
const pool = new Pool({
  host: process.env.POSTGRES_HOST ?? "postgres",
  port: Number(process.env.POSTGRES_PORT ?? "5432"),
  database: process.env.POSTGRES_DB ?? "appdb",
  user: process.env.POSTGRES_USER ?? "app",
  password: process.env.POSTGRES_PASSWORD ?? "app",
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function jitter(ms, ratio = 0.2) {
  const delta = ms * ratio;
  const r = (Math.random() * 2 - 1) * delta; // [-delta, +delta]
  return Math.round(ms + r);
}

function trimToLimit(text, limit = 2000) {
  const s = String(text ?? "");
  if (s.length <= limit) return s;
  return s.slice(0, Math.max(0, limit - 1)).trimEnd() + "…";
}

function getImageUrls(post, max = 4) {
  try {
    const out = [];
    const imgs = Array.isArray(post?.images) ? post.images : [];
    for (const it of imgs) {
      const u = it?.url;
      if (typeof u === "string" && u.trim() !== "") out.push(u.trim());
      if (out.length >= max) break;
    }

    if (out.length === 0 && typeof post?.imageUrl === "string" && post.imageUrl.trim() !== "") {
      out.push(post.imageUrl.trim());
    }

    return Array.from(new Set(out)).slice(0, max);
  } catch (e) {
    console.error("[getImageUrls] err =", e);
    return [];
  }
}

/* ---------------------------
 * FB layout helpers
 * -------------------------- */

function normalizeSpace(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function formatPhonePretty(s) {
  const raw = String(s ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  const d = digits.replace(/^\+66/, "0");
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function getTelNumbers(post) {
  try {
    const arr = Array.isArray(post?.tel_numbers) ? post.tel_numbers : [];
    const out = [];
    for (const t of arr) {
      const tel = String(t?.tel ?? "").trim();
      if (!tel) continue;
      out.push(tel);
    }
    return Array.from(new Set(out));
  } catch (e) {
    console.error("[getTelNumbers] err =", e);
    return [];
  }
}

function buildFacebookMessage(post) {
  /**
   * ✅ FB Layout (Scammer Alert):
   * - เตือนภัย + สรุป + เบอร์ที่เกี่ยวข้อง + ลิงก์อ้างอิง + วิธีป้องกัน + CTA
   */
  if (!post) return "";

  const title = normalizeSpace(post.title ?? "");
  const summary = normalizeSpace(post.summary ?? post.detail ?? "");
  const url = normalizeSpace(post.url ?? post.website ?? "");

  const telListAll = getTelNumbers(post)
    .map((t) => formatPhonePretty(t) ?? t)
    .filter(Boolean);

  const hook = summary ? summary.slice(0, 900) : "";

  const lines = [];

  lines.push("🚨 เตือนภัยมิจฉาชีพ / Scam Alert");
  if (title) lines.push(`⚠️ เรื่อง: ${title}`);
  lines.push("");

  if (hook) {
    lines.push("🧾 สรุปเหตุการณ์");
    lines.push(hook);
    lines.push("");
  }

  if (telListAll.length) {
    lines.push("📌 ข้อมูลที่ควรระวัง (เบอร์/ช่องทางที่เกี่ยวข้อง)");
    telListAll.slice(0, 4).forEach((t) => lines.push(`• ${t}`));
    if (telListAll.length > 4) lines.push(`• (+${telListAll.length - 4} รายการเพิ่มเติม)`);
    lines.push("");
  }

  if (url) {
    lines.push("🔗 ลิงก์อ้างอิง / หลักฐาน");
    lines.push(url);
    lines.push("");
  }

  lines.push("✅ วิธีป้องกัน (อ่านก่อนโอน/ก่อนกดลิงก์)");
  lines.push("• อย่าโอนเงิน/มัดจำ หากยังไม่ยืนยันตัวตนและหลักฐานให้ชัดเจน");
  lines.push("• ห้ามบอกรหัส OTP / รหัสผ่าน / เลขบัตร / ข้อมูลธนาคารกับใครเด็ดขาด");
  lines.push("• ระวังลิงก์แปลก ๆ และไฟล์ที่ส่งมาทางแชต");
  lines.push("• ขอหลักฐานเพิ่มเติม เช่น วิดีโอคอล, เอกสาร, เลขบัญชีตรงชื่อ");
  lines.push("• เก็บสกรีนช็อต/สลิป/แชตไว้เป็นหลักฐานทันที");
  lines.push("");

  lines.push("📣 หากมีข้อมูลเพิ่มเติมหรือเคสคล้ายกัน คอมเมนต์/อินบ็อกซ์แจ้งได้เลย");
  lines.push("ช่วยแชร์โพสต์นี้เพื่อเตือนคนอื่น ๆ ไม่ให้ตกเป็นเหยื่อ 🙏");

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ---------------------------
 * Retry/backoff
 * -------------------------- */

function calcBackoffMs(attempt) {
  const base = 3000;
  const ms = base * Math.pow(2, Math.max(0, attempt));
  return Math.min(ms, 10 * 60 * 1000);
}

async function pushDLQ(raw, reason) {
  await redis.lpush(DLQ_KEY, JSON.stringify({ raw, reason, at: new Date().toISOString() }));
}

async function scheduleRetry(raw, runAtMs) {
  await redis.zadd(DELAYED_KEY, String(runAtMs), raw);
}

async function pumpDelayed(batch = 50) {
  const now = Date.now();
  const raws = await redis.zrangebyscore(DELAYED_KEY, 0, now, "LIMIT", 0, batch);
  if (raws.length === 0) return 0;

  await redis.zrem(DELAYED_KEY, ...raws);
  await redis.rpush(QUEUE_KEY, ...raws);
  return raws.length;
}

/* ---------------------------
 * DB helpers
 * -------------------------- */

async function getPostAutoPublish(postId) {
  const { rows } = await pool.query(`SELECT id, auto_publish FROM posts WHERE id = $1`, [postId]);
  if (!rows?.length) return { exists: false, autoPublish: false };
  return { exists: true, autoPublish: rows[0].auto_publish === true };
}

/**
 * ✅ UPDATED: รองรับ permalink_url + published_at
 *
 * ต้องมีคอลัมน์:
 * - social_posts.permalink_url text
 * - social_posts.published_at timestamptz
 */
async function upsertSocialPost({
  postId,
  platform,
  status,
  socialPostId = null,
  lastError = null,
  permalinkUrl = null,
  publishedAt = null, // ISO string หรือ null
}) {
  await pool.query(
    `
    INSERT INTO social_posts (
      post_id, platform, status,
      social_post_id, last_error,
      permalink_url, published_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (post_id, platform)
    DO UPDATE SET
      status = EXCLUDED.status,
      social_post_id = COALESCE(EXCLUDED.social_post_id, social_posts.social_post_id),
      last_error = EXCLUDED.last_error,
      permalink_url = COALESCE(EXCLUDED.permalink_url, social_posts.permalink_url),
      published_at = COALESCE(EXCLUDED.published_at, social_posts.published_at),
      updated_at = now()
    `,
    [postId, platform, status, socialPostId, lastError, permalinkUrl, publishedAt]
  );
}

async function getExistingSocialPostId(postId, platform) {
  const { rows } = await pool.query(
    `SELECT social_post_id FROM social_posts WHERE post_id=$1 AND platform=$2`,
    [postId, platform]
  );
  return rows?.[0]?.social_post_id ?? null;
}

/* ---------------------------
 * Facebook helpers (images)
 * -------------------------- */

function getFacebookConfig() {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error("Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN");
  return { pageId, token };
}

function sanitizePublicUrl(input) {
  if (!input) return null;
  try {
    const u = new URL(String(input));
    u.hash = "";
    if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) {
      u.port = "";
    }
    return u.toString();
  } catch {
    return null;
  }
}

// ✅ เคย resolveAbsoluteUrl จาก xPublisher -> ย้ายมาเป็น util ในไฟล์นี้แทน
function resolveAbsoluteUrl(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  try {
    // already absolute
    if (/^https?:\/\//i.test(s)) return s;

    // use BASE_URL to turn relative into absolute
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL ?? "";
    if (!base) return s; // fallback: return as-is
    return new URL(s, base).toString();
  } catch {
    return s;
  }
}

async function publishToFacebookPage(message) {
  const { pageId, token } = getFacebookConfig();

  const res = await fetch(`https://graph.facebook.com/v24.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message, access_token: token }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`FB publish failed: ${JSON.stringify(json)}`);
  return json; // { id: "<pagePostId>" }
}

async function fbDeleteById({ objectId }) {
  const { token } = getFacebookConfig();

  const res = await fetch(
    `https://graph.facebook.com/v24.0/${objectId}?access_token=${encodeURIComponent(token)}`,
    { method: "DELETE" }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`FB delete failed: ${JSON.stringify(json)}`);
  return json;
}

/**
 * ✅ NEW: ดึง permalink_url ของโพสต์
 * ใช้ objectId ที่ FB คืนมา (เช่น "<pageid>_<postid>")
 */
async function fbGetPostPermalink({ objectId }) {
  const { token } = getFacebookConfig();
  if (!objectId) return null;

  const url = `https://graph.facebook.com/v24.0/${encodeURIComponent(objectId)}?fields=permalink_url&access_token=${encodeURIComponent(
    token
  )}`;

  const res = await fetch(url, { method: "GET" });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    // ไม่ให้ fail ทั้งงาน แค่ log แล้วคืน null
    console.warn("[fbGetPostPermalink] failed:", JSON.stringify(json));
    return null;
  }

  const p = typeof json?.permalink_url === "string" ? json.permalink_url : null;
  return p && p.trim() ? p.trim() : null;
}

async function fbUploadPhotoUnpublishedByUrl({ pageId, token, imageUrl }) {
  const body = new URLSearchParams({
    url: imageUrl,
    published: "false",
    access_token: token,
  });

  const res = await fetch(`https://graph.facebook.com/v24.0/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`FB upload photo failed: ${JSON.stringify(json)}`);
    err.fb = json;
    throw err;
  }
  return json?.id;
}



const insecureAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

async function downloadImageAsBlob(url, maxBytes = 15 * 1024 * 1024) {
  const res = await fetch(url, { method: "GET", redirect: "follow", dispatcher: insecureAgent });
  if (!res.ok) throw new Error(`download image failed: ${res.status} ${res.statusText}`);

  const ct = res.headers.get("content-type") ?? "";
  const len = Number(res.headers.get("content-length") ?? "0");
  if (len && len > maxBytes) throw new Error(`image too large: ${len} bytes`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error(`image too large (buffer): ${buf.length} bytes`);

  const type = ct && ct.includes("/") ? ct : "application/octet-stream";
  const blob = new Blob([buf], { type });
  return { blob, contentType: type, size: buf.length };
}

function guessExtFromContentType(ct) {
  const s = String(ct || "").toLowerCase();
  if (s.includes("jpeg") || s.includes("jpg")) return "jpg";
  if (s.includes("png")) return "png";
  if (s.includes("webp")) return "webp";
  if (s.includes("gif")) return "gif";
  return "bin";
}

async function fbUploadPhotoUnpublishedByBinary({ pageId, token, imageUrl }) {
  const { blob, contentType } = await downloadImageAsBlob(imageUrl);

  const form = new FormData();
  const ext = guessExtFromContentType(contentType);
  form.append("published", "false");
  form.append("access_token", token);
  form.append("source", blob, `upload.${ext}`);

  const res = await fetch(`https://graph.facebook.com/v24.0/${pageId}/photos`, {
    method: "POST",
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`FB binary upload photo failed: ${JSON.stringify(json)}`);
  return json?.id;
}

async function fbPublishSinglePhoto({ pageId, token, imageUrl, caption }) {
  const safeUrl = sanitizePublicUrl(imageUrl);
  if (!safeUrl) throw new Error(`Invalid image url: ${imageUrl}`);

  try {
    const body = new URLSearchParams({
      url: safeUrl,
      caption: caption ?? "",
      access_token: token,
    });

    const res = await fetch(`https://graph.facebook.com/v24.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`FB publish photo failed: ${JSON.stringify(json)}`);
    return json; // { id, post_id? }
  } catch {
    const { blob, contentType } = await downloadImageAsBlob(safeUrl);
    const form = new FormData();
    const ext = guessExtFromContentType(contentType);
    form.append("access_token", token);
    form.append("caption", caption ?? "");
    form.append("source", blob, `upload.${ext}`);

    const res = await fetch(`https://graph.facebook.com/v24.0/${pageId}/photos`, {
      method: "POST",
      body: form,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`FB binary publish photo failed: ${JSON.stringify(json)}`);
    return json;
  }
}

// function isFbUrlInvalidError(err) {
//   const msg = String(err?.message ?? err);
//   return msg.includes("url should represent a valid URL") || msg.includes('"code":100');
// }

function isFbUrlInvalidError(err) {
  const msg = String(err?.message ?? err);
  const code = err?.fb?.error?.code;
  const subcode = err?.fb?.error?.error_subcode;

  // เดิม
  if (msg.includes("url should represent a valid URL") || msg.includes('"code":100')) return true;

  // ✅ เพิ่ม: FB ดึงรูปจาก URL ไม่ได้ / ไฟล์ไม่ใช่รูป / รูป invalid
  // code 324 / subcode 2069019: Missing or invalid image file
  if (code === 324) return true;
  if (subcode === 2069019) return true;
  if (msg.includes("Missing or invalid image file")) return true;

  return false;
}

/**
 * ✅ UPDATED: return permalinkUrl (attempt), socialPostId
 */
async function publishToFacebookSmart({ action, post, postId, existingSocialPostId }) {
  const { pageId, token } = getFacebookConfig();

  if (action === "delete") {
    if (existingSocialPostId) {
      await fbDeleteById({ objectId: existingSocialPostId });
      return { socialPostId: existingSocialPostId, didDelete: true, permalinkUrl: null };
    }
    const r = await publishToFacebookPage(`Post ${postId} was deleted.`);
    const permalink = await fbGetPostPermalink({ objectId: r?.id ?? null });
    return { socialPostId: r?.id ?? null, didDelete: false, permalinkUrl: permalink };
  }

  const message = trimToLimit(buildFacebookMessage(post), 6000); // กันยาวเกิน

  const imageUrls = getImageUrls(post, 4)
    .map((u) => resolveAbsoluteUrl(u))
    .map((u) => sanitizePublicUrl(u))
    .filter(Boolean);

  // ไม่มีรูป -> feed ปกติ
  if (imageUrls.length === 0) {
    const r = await publishToFacebookPage(message);
    const permalink = await fbGetPostPermalink({ objectId: r?.id ?? null });
    return { socialPostId: r?.id ?? null, didDelete: false, permalinkUrl: permalink };
  }

  // รูปเดียว -> /photos (caption)
  if (imageUrls.length === 1) {
    const r = await fbPublishSinglePhoto({
      pageId,
      token,
      imageUrl: imageUrls[0],
      caption: message,
    });
    const objectId = r?.post_id ?? r?.id ?? null;
    const permalink = await fbGetPostPermalink({ objectId });
    return { socialPostId: objectId, didDelete: false, permalinkUrl: permalink };
  }

  // หลายรูป -> upload unpublished -> /feed attached_media
  const mediaFbIds = [];
  // for (const imgUrl of imageUrls) {
  //   try {
  //     const mediaId = await fbUploadPhotoUnpublishedByUrl({
  //       pageId,
  //       token,
  //       imageUrl: imgUrl,
  //     });
  //     if (!mediaId) throw new Error("FB upload returned empty media id");
  //     mediaFbIds.push(mediaId);
  //   } catch (e) {
  //     if (isFbUrlInvalidError(e)) {
  //       const mediaId = await fbUploadPhotoUnpublishedByBinary({
  //         pageId,
  //         token,
  //         imageUrl: imgUrl,
  //       });
  //       if (!mediaId) throw new Error("FB binary upload returned empty media id");
  //       mediaFbIds.push(mediaId);
  //     } else {
  //       throw e;
  //     }
  //   }
  // }

  for (const imgUrl of imageUrls) {
    try {
      const mediaId = await fbUploadPhotoUnpublishedByUrl({ pageId, token, imageUrl: imgUrl });
      if (!mediaId) throw new Error("FB upload returned empty media id");
      mediaFbIds.push(mediaId);
    } catch (e) {
      // ✅ ตอนนี้ error 324/2069019 จะเข้าเงื่อนไขนี้แล้ว
      if (isFbUrlInvalidError(e)) {
        const mediaId = await fbUploadPhotoUnpublishedByBinary({ pageId, token, imageUrl: imgUrl });
        if (!mediaId) throw new Error("FB binary upload returned empty media id");
        mediaFbIds.push(mediaId);
      } else {
        throw e;
      }
    }
  }

  const body = new URLSearchParams({ message, access_token: token });
  mediaFbIds.forEach((id, idx) => {
    body.append(`attached_media[${idx}]`, JSON.stringify({ media_fbid: id }));
  });

  const res = await fetch(`https://graph.facebook.com/v24.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`FB publish (multi photo) failed: ${JSON.stringify(json)}`);

  const objectId = json?.id ?? null;
  const permalink = await fbGetPostPermalink({ objectId });

  return { socialPostId: objectId, didDelete: false, permalinkUrl: permalink };
}

/* ---------------------------
 * main loop
 * -------------------------- */

console.log("[social-worker] started (facebook-only)");
console.log("[social-worker] keys:", { QUEUE_KEY, DLQ_KEY, DELAYED_KEY });

for (;;) {
  try {
    await pumpDelayed(50);

    const res = await redis.brpop(QUEUE_KEY, 10);
    if (!res) continue;

    const raw = res[1];

    let job;
    try {
      job = JSON.parse(raw);
      console.log("[raw] = ", raw);
    } catch {
      await pushDLQ(raw, "invalid json");
      continue;
    }

    const postId = job?.post?.postId;
    const platform = job?.platform;
    const action = job?.action;

    if (!postId || !platform || !action) {
      await pushDLQ(raw, "missing postId/platform/action");
      continue;
    }

    // ✅ รองรับเฉพาะ facebook
    if (platform !== "facebook") {
      await pushDLQ(raw, `unsupported platform (facebook-only): ${platform}`);
      continue;
    }

    if (action !== "delete") {
      const { exists, autoPublish } = await getPostAutoPublish(postId);
      if (!exists) {
        await pushDLQ(raw, "post not found (FK safe guard)");
        console.error("[social-worker] post not found -> DLQ", postId);
        continue;
      }

      if (!autoPublish) {
        await upsertSocialPost({
          postId,
          platform,
          status: "SKIPPED",
          lastError: "auto_publish=false",
        });
        console.log("[social-worker] skipped", platform, postId);
        continue;
      }
    }

    await upsertSocialPost({ postId, platform, status: "PENDING" });

    const attempts = Number(job.attempts ?? 0);
    const maxAttempts = Number(job.maxAttempts ?? 8);

    try {
      let socialPostId = null;
      let permalinkUrl = null;
      let publishedAt = null;

      const existingSocialPostId =
        action === "delete" ? await getExistingSocialPostId(postId, platform) : null;

      const out = await publishToFacebookSmart({
        action,
        post: job.post,
        postId,
        existingSocialPostId,
      });

      socialPostId = out.socialPostId ?? null;
      permalinkUrl = out.permalinkUrl ?? null;

      console.log("[social-worker] facebook done", {
        postId,
        action,
        didDelete: out.didDelete,
        existingSocialPostId,
        socialPostId,
        permalinkUrl,
      });

      const finalStatus = action === "delete" ? "DELETED" : "PUBLISHED";

      // ✅ ตั้งเวลา publish ตอนนี้เลย (เสถียร)
      if (finalStatus === "PUBLISHED") {
        publishedAt = new Date().toISOString();
      } else {
        publishedAt = null;
      }

      await upsertSocialPost({
        postId,
        platform,
        status: finalStatus,
        socialPostId,
        lastError: null,
        permalinkUrl,
        publishedAt,
      });

      console.log("[social-worker] ok", platform, action, postId, job.eventId);
    } catch (err) {
      console.error("[social-worker] err = ", err);

      const reason = String(err?.message ?? err);
      const failedStatus = action === "delete" ? "DELETED_FAILED" : "FAILED";

      await upsertSocialPost({
        postId,
        platform,
        status: failedStatus,
        lastError: reason,
      });

      const nextAttempt = attempts + 1;

      if (nextAttempt >= maxAttempts) {
        await pushDLQ(raw, `maxAttempts reached: ${reason}`);
        console.error("[social-worker] DLQ", platform, postId, reason);
      } else {
        const backoff = jitter(calcBackoffMs(nextAttempt), 0.2);
        const runAt = Date.now() + backoff;
        const retryJob = { ...job, attempts: nextAttempt, maxAttempts };
        await scheduleRetry(JSON.stringify(retryJob), runAt);

        console.warn("[social-worker] retry scheduled", platform, postId, `attempt=${nextAttempt}`, `in=${backoff}ms`);
      }
    }
  } catch (loopErr) {
    console.error("[social-worker] loop error = ", loopErr);
    await sleep(500);
  }
}
