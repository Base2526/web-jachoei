// ===== resolvers/phoneBlock.ts =====
import { GraphQLError } from "graphql/error";
import { query, runInTransaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

function asUserId(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

// ใช้ดึง status รวม + ของฉัน
async function getPhoneSafetyStatus(
  userId: string | null,
  phoneNorm: string,
  phoneRaw?: string
) {
  // summary (community)
  const sumRes = await query(
    `SELECT *
     FROM scam_phones_summary
     WHERE phone_normalized = $1
     LIMIT 1`,
    [phoneNorm]
  );
  const s = sumRes.rows[0] || null;

  // my block
  let my: any = null;
  if (userId) {
    const myRes = await query(
      `SELECT created_at
       FROM user_blocked_phones
       WHERE user_id = $1 AND phone_normalized = $2
       LIMIT 1`,
      [userId, phoneNorm]
    );
    my = myRes.rows[0] || null;
  }

  const blockedByCount = Number(s?.blocked_by_count || 0);
  const reportCount = Number(s?.report_count || 0);
  const risk = Number(s?.risk_level ?? (blockedByCount * 4 + reportCount * 6));

  return {
    phone: phoneRaw || phoneNorm,
    phone_normalized: phoneNorm,

    my_blocked: !!my,
    my_blocked_at: my?.created_at ? new Date(my.created_at).toISOString() : null,

    blocked_by_count: blockedByCount,
    last_blocked_at: s?.last_blocked_at ? new Date(s.last_blocked_at).toISOString() : null,

    report_count: reportCount,
    last_report_at: s?.last_report_at ? new Date(s.last_report_at).toISOString() : null,

    risk_level: Math.max(0, Math.min(100, risk)),
    updated_at: s?.updated_at ? new Date(s.updated_at).toISOString() : new Date().toISOString(),
  };
}

export const phoneResolvers = {
  Query: {
    phoneSafetyStatus: async (_: any, { phone }: { phone: string }, ctx: any) => {
      const auth = requireAuth(ctx, { optionalWeb: true, optionalAndroid: true });
      const userId = asUserId(auth.author_id);

      const norm = normalizePhone(phone);
      if (!norm) throw new GraphQLError("Invalid phone");

      return getPhoneSafetyStatus(userId, norm, phone);
    },

    myBlockedPhones: async (_: any, { limit = 50, offset = 0 }: any, ctx: any) => {
      const auth = requireAuth(ctx);
      const userId = asUserId(auth.author_id);
      if (!userId) throw new GraphQLError("Unauthorized");

      const safeLimit = Math.min(Math.max(limit, 1), 200);
      const safeOffset = Math.max(offset, 0);

      const res = await query(
        `
        SELECT
          ub.phone,
          ub.phone_normalized,
          ub.created_at AS my_blocked_at,
          s.blocked_by_count,
          s.last_blocked_at,
          s.report_count,
          s.last_report_at,
          s.risk_level,
          s.updated_at
        FROM user_blocked_phones ub
        LEFT JOIN scam_phones_summary s
          ON s.phone_normalized = ub.phone_normalized
        WHERE ub.user_id = $1
        ORDER BY ub.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [userId, safeLimit, safeOffset]
      );

      return res.rows.map((r: any) => ({
        phone: r.phone,
        phone_normalized: r.phone_normalized,
        my_blocked: true,
        my_blocked_at: r.my_blocked_at ? new Date(r.my_blocked_at).toISOString() : null,
        blocked_by_count: Number(r.blocked_by_count || 0),
        last_blocked_at: r.last_blocked_at ? new Date(r.last_blocked_at).toISOString() : null,
        report_count: Number(r.report_count || 0),
        last_report_at: r.last_report_at ? new Date(r.last_report_at).toISOString() : null,
        risk_level: Number(r.risk_level || 0),
        updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      }));
    },
  },

  Mutation: {
    blockPhone: async (_: any, { input }: any, ctx: any) => {
      const auth = requireAuth(ctx);
      const userId = asUserId(auth.author_id);
      if (!userId) throw new GraphQLError("Unauthorized");

      const phoneRaw = String(input?.phone || "");
      const phoneNorm = normalizePhone(phoneRaw);
      if (!phoneNorm) throw new GraphQLError("Invalid phone");

      await runInTransaction(userId, async (client) => {
        await client.query(
          `
          INSERT INTO user_blocked_phones (user_id, phone, phone_normalized)
          VALUES ($1,$2,$3)
          ON CONFLICT (user_id, phone_normalized) DO NOTHING
          `,
          [userId, phoneRaw, phoneNorm]
        );

        const cntRes = await client.query(
          `SELECT COUNT(*)::int AS c
           FROM user_blocked_phones
           WHERE phone_normalized = $1`,
          [phoneNorm]
        );
        const blockedCnt = Number(cntRes.rows[0]?.c || 0);

        const sumRes = await client.query(
          `SELECT report_count
           FROM scam_phones_summary
           WHERE phone_normalized = $1`,
          [phoneNorm]
        );
        const reportCnt = Number(sumRes.rows[0]?.report_count || 0);

        await client.query(
          `
          INSERT INTO scam_phones_summary
            (phone_normalized, blocked_by_count, last_blocked_at, report_count, risk_level, updated_at)
          VALUES
            ($1, $2, now(), $3, calc_phone_risk($2, $3), now())
          ON CONFLICT (phone_normalized)
          DO UPDATE SET
            blocked_by_count = EXCLUDED.blocked_by_count,
            last_blocked_at  = now(),
            risk_level       = calc_phone_risk(EXCLUDED.blocked_by_count, scam_phones_summary.report_count),
            updated_at       = now()
          `,
          [phoneNorm, blockedCnt, reportCnt]
        );
      });

      const status = await getPhoneSafetyStatus(userId, phoneNorm, phoneRaw);
      return { ok: true, status };
    },

    unblockPhone: async (_: any, { input }: any, ctx: any) => {
      const auth = requireAuth(ctx);
      const userId = asUserId(auth.author_id);
      if (!userId) throw new GraphQLError("Unauthorized");

      const phoneRaw = String(input?.phone || "");
      const phoneNorm = normalizePhone(phoneRaw);
      if (!phoneNorm) throw new GraphQLError("Invalid phone");

      await runInTransaction(userId, async (client) => {
        await client.query(
          `
          DELETE FROM user_blocked_phones
          WHERE user_id = $1 AND phone_normalized = $2
          `,
          [userId, phoneNorm]
        );

        const cntRes = await client.query(
          `SELECT COUNT(*)::int AS c
           FROM user_blocked_phones
           WHERE phone_normalized = $1`,
          [phoneNorm]
        );
        const blockedCnt = Number(cntRes.rows[0]?.c || 0);

        await client.query(
          `
          INSERT INTO scam_phones_summary
            (phone_normalized, blocked_by_count, last_blocked_at, risk_level, updated_at)
          VALUES
            ($1, $2, CASE WHEN $2>0 THEN now() ELSE NULL END, calc_phone_risk($2, 0), now())
          ON CONFLICT (phone_normalized)
          DO UPDATE SET
            blocked_by_count = $2,
            last_blocked_at  = CASE WHEN $2>0 THEN now() ELSE scam_phones_summary.last_blocked_at END,
            risk_level       = calc_phone_risk($2, scam_phones_summary.report_count),
            updated_at       = now()
          `,
          [phoneNorm, blockedCnt]
        );
      });

      const status = await getPhoneSafetyStatus(userId, phoneNorm, phoneRaw);
      return { ok: true, status };
    },
  },
};
