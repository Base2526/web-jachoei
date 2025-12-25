import { GraphQLError } from "graphql/error";
import { createHash, randomBytes } from "crypto";

interface RequireAuthOptions {
  optional?: boolean;      // soft mode → ไม่ throw
  optionalWeb?: boolean;   // soft เฉพาะเว็บ
  optionalAdmin?: boolean; // soft เฉพาะ admin
}

export function requireAuth(ctx: any, opts: RequireAuthOptions = {}) {
  const scope = ctx?.scope;

  // กรณีไม่มี scope เลย (มาจาก client ไม่ถูกต้อง)
  if (!scope || !['web', 'admin'].includes(scope)) {
    if (opts.optional || opts.optionalWeb || opts.optionalAdmin) {
      return { scope: null, author_id: null, isAuthenticated: false };
    }
    throw new GraphQLError("Unauthorized scope", {
      extensions: {
        code: "UNAUTHENTICATED",
        reason: "invalid_scope",
        http: { status: 401 },
      },
    });
  }

  let author_id = null;

  if (scope === "admin") {
    author_id = ctx?.admin?.id ?? null;

    // ถ้าไม่มี author_id และ optionalAdmin → กลับแบบ soft
    if (!author_id && (opts.optional || opts.optionalAdmin)) {
      return { scope: "admin", author_id: null, isAuthenticated: false };
    }

    if (!author_id) {
      throw new GraphQLError("Admin not authenticated", {
        extensions: {
          code: "UNAUTHENTICATED",
          reason: "backend_admin",
          http: { status: 401 },
        },
      });
    }

    return { scope, author_id, isAuthenticated: true };
  }

  if (scope === "web") {
    author_id = ctx?.user?.id ?? null;

    // soft mode ของ web
    if (!author_id && (opts.optional || opts.optionalWeb)) {
      return { scope: "web", author_id: null, isAuthenticated: false };
    }

    if (!author_id) {
      throw new GraphQLError("User not authenticated", {
        extensions: {
          code: "UNAUTHENTICATED",
          reason: "frontend_user",
          http: { status: 401 },
        },
      });
    }

    return { scope, author_id, isAuthenticated: true };
  }

  // fallback ปลอดภัย
  if (opts.optional) {
    return { scope: null, author_id: null, isAuthenticated: false };
  }

  throw new GraphQLError("Invalid authentication context", {
    extensions: {
      code: "UNAUTHENTICATED",
      http: { status: 401 },
    },
  });
}

export function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function generateRawToken() {
  return randomBytes(32).toString("hex");
}