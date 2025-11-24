import th from "./th";
import en from "./en";

export type Lang = "th" | "en";

export const messages = {
  th,
  en,
};

export function getMessage(lang: Lang, path: string): string {
  const parts = path.split(".");
  let obj: any = messages[lang];

  for (const p of parts) {
    if (obj && typeof obj === "object" && p in obj) {
      obj = obj[p];
    } else {
      return path; // fallback คืน key เอง
    }
  }

  return typeof obj === "string" ? obj : path;
}
