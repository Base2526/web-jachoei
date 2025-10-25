// utils/storage.ts
export type StoredUser = { id: string; name?: string; role?: string };

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;          // SSR guard
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    const u = JSON.parse(raw);
    // เช็คขั้นต่ำให้มี id เป็น string
    return u && typeof u.id === "string" ? (u as StoredUser) : null;
  } catch {
    return null;
  }
}
