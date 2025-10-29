// app/(admin)/admin/layout.tsx
// import AdminHeader from '@/components/AdminHeader';
import { cookies } from 'next/headers';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const langCookie = cookies().get('lang')?.value ?? 'th'; // 'th' | 'en'
  return (
      <>
        {/* <AdminHeader initialLang={langCookie as 'th'|'en'}/> */}
        <main style={{ padding: 24 }}>{children}</main>
      </>
  );
}