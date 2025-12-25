import Mustache from "mustache";
import { query } from "@/lib/db";

export type EmailTemplateRow = {
  id: string;
  key: string;
  locale: string;
  version: number;
  subject_tpl: string;
  html_tpl: string;
  text_tpl: string | null;
};

export async function getLatestEmailTemplate(key: string, locale: string): Promise<EmailTemplateRow> {
  const { rows } = await query<EmailTemplateRow>(
    `
    SELECT id, key, locale, version, subject_tpl, html_tpl, text_tpl
    FROM email_templates
    WHERE key = $1
      AND locale = $2
      AND is_active = true
      AND is_published = true
    ORDER BY version DESC
    LIMIT 1
    `,
    [key, locale]
  );

  if (rows[0]) return rows[0];

  // fallback locale -> en
  if (locale !== "en") return getLatestEmailTemplate(key, "en");

  throw new Error(`Email template not found: key=${key}, locale=${locale}`);
}

export function renderEmailTemplate(
  tpl: EmailTemplateRow,
  data: Record<string, any>
): { subject: string; html: string; text?: string } {
  // Mustache escape HTML by default (ปลอดภัย)
  const subject = Mustache.render(tpl.subject_tpl, data);
  const html = Mustache.render(tpl.html_tpl, data);
  const text = tpl.text_tpl ? Mustache.render(tpl.text_tpl, data) : undefined;

  return { subject, html, text };
}
