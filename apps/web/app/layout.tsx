// ❌ ห้ามมี "use client" ที่นี่
import 'antd/dist/reset.css';
import "./globals.css";

import { cookies } from "next/headers";
import type { Lang } from "@/i18n";
import ClientProviders from "./ClientProviders";  // เราจะสร้างไฟล์นี้ใหม่

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const langCookie = cookieStore.get("lang")?.value as Lang | undefined;
  const lang: Lang = langCookie === "en" ? "en" : "th";

  return (
    <html lang={lang}>
      <body>
        {/* ส่ง lang ให้ ClientProviders */}
        <ClientProviders lang={lang}>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
