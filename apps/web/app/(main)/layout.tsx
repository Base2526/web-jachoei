// app/(main)/layout.tsx
import HeaderBar from '@/components/HeaderBar';
import { cookies } from 'next/headers';

import AppLayout from "@/components/AppLayout";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const langCookie = cookies().get('lang')?.value ?? 'th'; // 'th' | 'en'
  return (
      <>
        {/* <HeaderBar initialLang={langCookie as 'th'|'en'}/> */}
        <AppLayout>{children}</AppLayout>
      </>
  );
}
