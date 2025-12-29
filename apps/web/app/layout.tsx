import 'antd/dist/reset.css';
import "./globals.css";

import { cookies } from "next/headers";
import type { Lang } from "@/i18n";
import ClientProviders from "./ClientProviders";  // เราจะสร้างไฟล์นี้ใหม่

import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://whosscam.com'}`),
  icons: {
    icon: "/favicon.ico",
  },
};

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
