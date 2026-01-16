// app/(main)/layout.tsx
import HeaderBar from '@/components/HeaderBar';
import { cookies } from 'next/headers';
import type { Metadata } from "next";
import AppLayout from "@/components/AppLayout";

const SITE_NAME = "Jachoei";
const SITE_URL  = process.env.NEXT_PUBLIC_BASE_URL || "https://jachoei.com";

export async function generateMetadata(): Promise<Metadata> {
  const lang = cookies().get("lang")?.value === "en" ? "en" : "th";

  const seo = {
    th: {
      title: "Jachoei — ตรวจสอบการโกงออนไลน์",
      desc:
        "ฐานข้อมูลการโกงออนไลน์ ตรวจสอบเบอร์โทร บัญชีธนาคาร ลิงก์ และชื่อเพจ จากรายงานผู้ใช้งานจริง",
    },
    en: {
      title: "Jachoei — Online Scam Database",
      desc:
        "Search and report online scams. Check phone numbers, bank accounts, links, and pages from community reports.",
    },
  }[lang];

  return {
    metadataBase: new URL(SITE_URL), // ⭐ ทำให้ OG image เป็น absolute
    title: {
      default: seo.title,
      template: `%s | ${SITE_NAME}`,
    },
    description: seo.desc,
    alternates: { canonical: SITE_URL },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,          
      title: seo.title,
      description: seo.desc,
      url: SITE_URL,
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.desc,
      images: ["/og.png"],
    },
    robots: { index: true, follow: true },
  };
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const langCookie = cookies().get('lang')?.value ?? 'th'; // 'th' | 'en'
  return (
      <>
        {/* <HeaderBar initialLang={langCookie as 'th'|'en'}/> */}
        <AppLayout>{children}</AppLayout>
      </>
  );
}
