'use client';
import { usePathname } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideHeader = pathname === "/admin/login";

  return (
    <>
      {!hideHeader && (
        <header style={{ padding: 24, paddingBottom: 0 }}>
          <AdminHeader />
        </header>
      )}
      <main style={{ padding: 24 }}>{children}</main>
    </>
  );
}
